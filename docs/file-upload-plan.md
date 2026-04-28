# 파일 업로드 기능 추가 계획

작성일: 2026-04-09  
요청: 원장님이 직접 약력/증명서/도면/사진 등을 업로드할 수 있게

---

## 1. 요청 정리

### 1-1. 약력 (경력)
**이중 입력 방식:**
- 옵션 A: 텍스트 직접 입력 (현재 `doctorCareer` 필드)
- 옵션 B: 이미지 업로드 (jpg/png) — 기존 이력서/약력서 사진 첨부

### 1-2. 첨부파일 (PDF / jpg / png)
| 파일 | 예상 크기 | 형식 | 비고 |
|------|----------|------|------|
| 로고 | 0.5~2MB | png/jpg/svg | 투명 배경 권장 |
| 치과의사 면허증 | 1~3MB | PDF/jpg/png | 원장 본인 |
| 전문의 자격증 | 1~3MB | PDF/jpg/png | 의료진 N명만큼 |
| 인테리어 3D 도면 | 5~30MB | PDF | **가장 큼** |
| 사업자등록증 | 0.5~1MB | PDF/jpg/png | |
| 개설필증 | 0.5~1MB | PDF/jpg/png | 의료기관 개설 신고증 |
| 간판사진 | 2~5MB | jpg/png | 휴대폰 사진 |
| 현수막사진 | 2~5MB | jpg/png | |
| 공사현장사진 | 5~20MB (여러 장) | jpg/png | 다중 업로드 |

**치과 1곳당 예상 총 용량: 30~80MB**

---

## 2. Notion 저장 용량 분석

### 2-1. Notion API 파일 업로드 제한 (2024년 도입)

| 플랜 | 단일 업로드 | 멀티파트 업로드 | 워크스페이스 총 용량 |
|------|------------|----------------|--------------------|
| **Free** | 5MB/파일 | 미지원 | 사실상 무제한 (파일당 5MB 제약) |
| **Plus** ($10/월/명) | 20MB/파일 | **5GB/파일** | 무제한 (파일당 2GB 소프트 한도) |
| **Business** ($20/월/명) | 20MB/파일 | 5GB/파일 | 무제한 |

### 2-2. 우리 서비스 예상 사용량

| 시나리오 | 파일 수 | 총 용량 | 결론 |
|---------|--------|--------|------|
| 1년 100곳 거래처 | 약 1,000개 | 5~8 GB | ✅ Plus 플랜 충분 |
| 1년 500곳 거래처 | 약 5,000개 | 25~40 GB | ✅ Plus 플랜 충분 |
| 인테리어 3D 도면 30MB | 개별 | — | ⚠️ Free 플랜 불가 (5MB 제한 초과) |

### 2-3. 결론

> **Notion에 직접 저장: Plus 이상 플랜이면 용량 문제 없음**
>
> 단, Free 플랜이면 **5MB 초과 파일 업로드 불가** → 인테리어 3D 도면 등은 별도 호스팅 필요

---

## 3. 구현 방안 비교

### 방안 A: Notion API 직접 업로드 (Plus 플랜 전제)

```
원장님 → 폼 → /api/upload → Notion 파일 업로드 API → Notion 페이지에 첨부
```

**장점:**
- 모든 파일이 Notion 안에 통합
- 추가 인프라/비용 없음 (Notion 플랜 비용만)
- 디자인팀/마케팅팀이 Notion 한 곳에서 모든 자료 확인

**단점:**
- Free 플랜은 5MB 제한 (3D 도면 불가)
- 멀티파트 업로드 구현 복잡 (5MB 청크 단위)
- 파일 삭제/관리 Notion에서 수동

**구현 시간:** 4~6시간

---

### 방안 B: Vercel Blob에 업로드 + Notion에 URL 저장

```
원장님 → 폼 → /api/upload → Vercel Blob → public URL → Notion에 링크/이미지 블록
```

**장점:**
- 파일 크기 제한 적음 (Vercel Blob 5GB/파일)
- 멀티파트 자동 처리
- Notion 플랜 무관

**단점:**
- Vercel Blob 비용 발생 (Hobby: 1GB/월 무료 / Pro: 100GB 포함)
- 파일이 두 곳(Vercel + Notion 링크)에 분리

**비용 (Pro 플랜 기준):**
- 100곳 × 50MB = 5GB → **Pro 플랜 100GB 무료 한도 내**
- 500곳 × 50MB = 25GB → **여전히 무료 한도 내**
- 1000곳 × 80MB = 80GB → **여전히 무료 한도 내**

**구현 시간:** 2~3시간

---

### 방안 C: 하이브리드 (Vercel Blob + Notion 임베드)

```
업로드 → Vercel Blob → public URL
                ↓
                Notion 페이지에 "파일" 또는 "이미지" 블록으로 외부 URL 임베드
```

**장점:**
- 방안 B의 모든 장점
- Notion에서도 미리보기 가능 (이미지/PDF는 외부 URL 임베드 시 미리보기 작동)
- Free 플랜에서도 동작

**단점:**
- 외부 URL이라 Vercel Blob이 종료되면 깨짐 (장기 보관 우려)

**구현 시간:** 2~3시간

---

## 4. 권장안: 방안 C (하이브리드)

### 이유
1. Notion 플랜 무관하게 동작
2. 무료 한도 내에서 충분 (1000곳까지)
3. 구현 단순 (Vercel Blob SDK 1줄로 업로드)
4. Notion에서 미리보기 가능

### 단점 보완
- **장기 보관 우려 → 백업 정책**: 1년 1회 Vercel Blob → S3 또는 Google Drive 정기 백업
- **URL 깨짐 우려 → 재업로드 가능**: 관리자 페이지에서 파일만 재업로드 (Notion 페이지 ID는 유지)

---

## 5. 구현 단계

### 5-1. 패키지 설치
```bash
npm install @vercel/blob
```

### 5-2. 환경변수 추가 (Vercel)
```
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxx
```
(Vercel Dashboard → Storage → Create Blob → 자동 생성)

### 5-3. 업로드 API 작성 (`/api/upload/route.ts`)
```typescript
import { put } from '@vercel/blob';

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get('file') as File;
  const category = formData.get('category') as string; // 'logo' | 'license' 등

  // 파일 형식/크기 검증
  const ALLOWED = { logo: ['png','jpg','svg'], blueprint: ['pdf'], doc: ['pdf','jpg','png'] };
  const MAX_SIZE = 30 * 1024 * 1024; // 30MB
  if (file.size > MAX_SIZE) return Response.json({ error: '파일 크기 초과' }, { status: 400 });

  const blob = await put(`${category}/${Date.now()}-${file.name}`, file, {
    access: 'public',
    contentType: file.type,
  });

  return Response.json({ url: blob.url, filename: file.name });
}
```

### 5-4. 폼 UI: 약력 (이중 입력)

```tsx
// Step1 또는 Step4
<div>
  <label>약력</label>
  <Tabs>
    <Tab label="텍스트로 입력">
      <textarea
        value={doctorCareer}
        onChange={e => onChange({ doctorCareer: e.target.value })}
        placeholder="예: 서울대 치의학과 졸업, OO치과 원장"
      />
    </Tab>
    <Tab label="이미지로 업로드">
      <FileUpload
        accept="image/jpeg,image/png"
        maxSize={10}
        onUploaded={url => onChange({ careerImageUrl: url })}
      />
    </Tab>
  </Tabs>
</div>
```

### 5-5. 폼 UI: 첨부파일 섹션

```tsx
// Step4 (브랜딩) 또는 신규 Step
<section>
  <h3>첨부 자료</h3>

  <FileUploadField label="로고" category="logo" accept="png,jpg,svg" />
  <FileUploadField label="치과의사 면허증" category="license" accept="pdf,jpg,png" />
  <FileUploadField label="전문의 자격증" category="cert" accept="pdf,jpg,png" multi />
  <FileUploadField label="인테리어 3D 도면" category="blueprint" accept="pdf" maxSize={50} />
  <FileUploadField label="사업자등록증" category="business" accept="pdf,jpg,png" />
  <FileUploadField label="개설필증" category="permit" accept="pdf,jpg,png" />
  <FileUploadField label="간판 사진" category="signage" accept="jpg,png" />
  <FileUploadField label="현수막 사진" category="banner" accept="jpg,png" multi />
  <FileUploadField label="공사현장 사진" category="construction" accept="jpg,png" multi maxFiles={10} />
</section>
```

### 5-6. Notion 저장 (이미지 블록 + 파일 링크)

```typescript
// notion.ts에 추가
export async function appendFilesToPage(
  pageId: string,
  files: { category: string; url: string; filename: string }[]
) {
  const blocks = files.map(f => {
    const isImage = /\.(jpg|jpeg|png|gif)$/i.test(f.filename);
    if (isImage) {
      return {
        type: 'image',
        image: { type: 'external', external: { url: f.url } }
      };
    }
    return {
      type: 'file',
      file: {
        type: 'external',
        external: { url: f.url },
        caption: [{ type: 'text', text: { content: `[${f.category}] ${f.filename}` } }]
      }
    };
  });

  await notion.blocks.children.append({
    block_id: pageId,
    children: blocks,
  });
}
```

### 5-7. Notion 메인 DB 컬럼 추가 (수동)

| 컬럼명 | 타입 | 비고 |
|--------|------|------|
| `로고URL` | URL | Vercel Blob 링크 |
| `면허증URL` | URL | |
| `자격증URL목록` | Rich Text | 여러 개일 경우 줄바꿈 |
| `3D도면URL` | URL | |
| `사업자등록증URL` | URL | |
| `개설필증URL` | URL | |
| `간판사진URL` | URL | |
| `현수막사진URL목록` | Rich Text | |
| `공사현장사진URL목록` | Rich Text | |
| `약력이미지URL` | URL | (텍스트 입력 안 한 경우) |

---

## 6. UX 디테일

### 6-1. 업로드 프로그레스
```
[📎 파일 선택]  →  [▰▰▰▰▱ 78%]  →  [✅ 업로드 완료]
```

### 6-2. 미리보기
- 이미지: 썸네일 표시
- PDF: 파일명 + "PDF 보기" 링크
- 업로드 후 "삭제" 버튼으로 재업로드 가능

### 6-3. 다중 파일 (공사현장 사진 등)
- 드래그 앤 드롭 영역
- 최대 10장 제한
- 각각 개별 삭제 가능

### 6-4. 검증
- 파일 형식: 클라이언트 + 서버 양쪽 검증
- 파일 크기: 클라이언트에서 사전 차단 (서버 부하 방지)
- 빈 파일 거부

---

## 7. 보안 고려사항

| 항목 | 대책 |
|------|------|
| 악성 파일 업로드 | 형식 화이트리스트 + Magic byte 검증 |
| 무한 업로드 abuse | Rate limiting (5분당 20회 제한) |
| Public URL 유출 | Vercel Blob URL은 공개적으로 추측 불가능한 해시 사용 |
| 파일 영구 보관 | 1년 후 자동 만료 옵션 (선택) |

---

## 8. 일정 / 비용 요약

| 항목 | 시간 / 비용 |
|------|------------|
| 개발 시간 | 4~5시간 (방안 C 기준) |
| Vercel Blob 추가 비용 | $0 (무료 한도 내) |
| Notion 플랜 추가 비용 | $0 (현재 플랜 유지 가능) |
| Notion 신규 컬럼 추가 (수동) | 5분 |

---

## 9. 결정 필요 사항

이사님께 확인:
1. **파일 호스팅 방식**: Vercel Blob 사용 OK인지? (방안 C 권장)
2. **다중 파일 허용**: 전문의 자격증/현수막/공사현장사진 — 여러 장 업로드 허용?
3. **약력 입력 방식**: 텍스트 OR 이미지 둘 중 선택? 둘 다 함께?
4. **파일 만료 정책**: 1년 후 자동 삭제 vs 영구 보관?
5. **첨부 필수 여부**: 면허증/개설필증 등은 필수인지, 선택인지?

---

## Sources

- [Notion API: Working with Files and Media](https://developers.notion.com/docs/working-with-files-and-media)
- [Notion API: Uploading Larger Files (Multi-part)](https://developers.notion.com/docs/sending-larger-files)
- [Notion Help: Images, files & media limits](https://www.notion.com/help/images-files-and-media)
- [Vercel Blob Documentation](https://vercel.com/docs/storage/vercel-blob)
