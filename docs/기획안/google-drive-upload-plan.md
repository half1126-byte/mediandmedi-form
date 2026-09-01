# Google Drive 자동 업로드 구현 계획

작성일: 2026-04-09  
요청: 폼에서 파일 업로드 버튼 → 회사 Google Drive로 자동 저장

---

## 1. 결론

> **회사가 Google Workspace 사용 중이라면 가장 실용적인 선택지**  
> 디자인팀/마케팅팀이 평소 쓰던 Drive에서 바로 확인 가능

---

## 2. 선택지 3가지 종합 비교 (현재 시점)

| 항목 | A) Notion Plus | B) FTP 호스팅 | **C) Google Drive** ⭐ |
|------|--------------|--------------|---------------------|
| 추가 비용 | ₩0 (이미 가입) | ₩0 (이미 가입) | ₩0 (Workspace 보유 시) |
| 용량 | 5GB/파일 | 호스팅 한도 (10~100GB) | 30GB~2TB (플랜에 따라) |
| 구현 시간 | 4~6시간 | 2~3시간 | **2~3시간** |
| 파일 관리 | Notion 페이지 안 | FileZilla로만 | **Drive 웹/앱에서 직관적** ⭐ |
| 디자인팀 접근성 | Notion에서 보기만 | URL로만 접근 | **Drive 즐겨찾기/공유 가능** ⭐ |
| URL 공유 | 외부 임베드 어려움 | 직접 URL | 권한 설정으로 유연 |
| 모바일 확인 | Notion 앱 | 브라우저만 | **Drive 앱에서 미리보기** ⭐ |
| 검색 | Notion 검색 | 검색 불가 | **Drive 강력한 검색** ⭐ |

---

## 3. Google Drive 상세 분석

### 3-1. 인증 방식: 서비스 계정 (Service Account) ⭐ 권장

```
원장님 → 폼 → /api/upload (서비스 계정 인증) → Google Drive 회사 폴더 → 공유 링크
                                                                          ↓
                                                                Notion에 URL 저장
```

**왜 서비스 계정?**
- 원장님이 별도 Google 로그인 안 해도 됨
- 모든 파일이 회사 Drive에 일관되게 저장
- API 키만 Vercel에 설정하면 끝

### 3-2. 용량 (Google Workspace 플랜별)

| 플랜 | 사용자당 용량 | 풀링 가능 |
|------|------------|---------|
| Business Starter | 30 GB | X |
| **Business Standard** | **2 TB** | O (조직 내 공유) |
| Business Plus | 5 TB | O |
| Enterprise | 무제한 | O |

> 1년 1000곳 거래처 = 약 30~80GB → **Business Standard로 충분**

### 3-3. API 쿼터

| 항목 | 한도 |
|------|------|
| 파일 업로드 | 분당 1,000회 |
| API 쿼리 | 100초당 20,000회 |
| 우리 사용량 | 하루 ~50회 (여유) |

**API 한도 걱정 없음**

---

## 4. 구현 단계

### Step 1. Google Cloud 프로젝트 + 서비스 계정 생성 (10분)

1. https://console.cloud.google.com → 새 프로젝트 (예: "mediandmedi-form")
2. API 및 서비스 → Google Drive API **활성화**
3. 서비스 계정 만들기:
   - 이름: `mediandmedi-form-uploader`
   - 이메일: `mediandmedi-form-uploader@xxx.iam.gserviceaccount.com` (자동 생성)
4. JSON 키 발급 → 다운로드 (한 번만)

### Step 2. Google Drive 폴더 준비 (5분)

1. Google Drive에서 폴더 생성 (예: `메디앤메디_파일업로드`)
2. 서비스 계정 이메일에 폴더 **공유** (편집자 권한)
3. 폴더 ID 복사 (URL의 `folders/` 다음 부분)
4. 하위 폴더 미리 생성:
   ```
   메디앤메디_파일업로드/
   ├── 로고/
   ├── 면허증/
   ├── 자격증/
   ├── 3D도면/
   ├── 사업자등록증/
   ├── 개설필증/
   ├── 간판사진/
   ├── 현수막사진/
   ├── 공사현장/
   └── 약력이미지/
   ```

### Step 3. 패키지 설치

```bash
npm install googleapis
```

### Step 4. 환경변수 (Vercel + .env.local)

```env
GOOGLE_DRIVE_CLIENT_EMAIL=mediandmedi-form-uploader@xxx.iam.gserviceaccount.com
GOOGLE_DRIVE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_DRIVE_PARENT_FOLDER_ID=1AbCdEfGhIjKlMnOp...
```

> JSON 키 파일에서 `client_email`과 `private_key`만 추출

### Step 5. 업로드 API (`/api/upload/route.ts`)

```typescript
import { google } from 'googleapis';
import { Readable } from 'stream';

export const runtime = 'nodejs';

const FOLDER_MAP: Record<string, string> = {
  logo: '로고',
  license: '면허증',
  certificate: '자격증',
  blueprint: '3D도면',
  business: '사업자등록증',
  permit: '개설필증',
  signage: '간판사진',
  banner: '현수막사진',
  construction: '공사현장',
  career: '약력이미지',
};

async function getOrCreateSubFolder(drive: any, name: string, parentId: string) {
  const search = await drive.files.list({
    q: `'${parentId}' in parents and name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
  });
  if (search.data.files?.length) return search.data.files[0].id!;
  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
  });
  return created.data.id!;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get('file') as File;
  const category = formData.get('category') as string;
  const clinicName = formData.get('clinicName') as string || '미정';

  // 검증
  const MAX_SIZE = 50 * 1024 * 1024; // 50MB
  if (file.size > MAX_SIZE) {
    return Response.json({ error: '파일 크기 초과 (최대 50MB)' }, { status: 400 });
  }

  // 인증
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_DRIVE_CLIENT_EMAIL,
    key: process.env.GOOGLE_DRIVE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });
  const drive = google.drive({ version: 'v3', auth });

  // 카테고리 폴더 확보
  const subFolderName = FOLDER_MAP[category] || '기타';
  const subFolderId = await getOrCreateSubFolder(
    drive, subFolderName, process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID!
  );

  // 치과별 하위 폴더 (예: "365편한일층치과의원_2026-04-09")
  const dateStr = new Date().toISOString().slice(0, 10);
  const clinicFolderName = `${clinicName}_${dateStr}`;
  const clinicFolderId = await getOrCreateSubFolder(drive, clinicFolderName, subFolderId);

  // 업로드
  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = file.name.replace(/[^\w가-힣.-]/g, '_');

  const uploaded = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [clinicFolderId],
    },
    media: {
      mimeType: file.type,
      body: Readable.from(buffer),
    },
    fields: 'id, webViewLink, webContentLink',
  });

  // 누구나 링크로 보기 가능하게 (선택, 공유 정책에 맞게)
  await drive.permissions.create({
    fileId: uploaded.data.id!,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  });

  return Response.json({
    fileId: uploaded.data.id,
    viewUrl: uploaded.data.webViewLink,    // Drive 미리보기
    downloadUrl: uploaded.data.webContentLink, // 직접 다운로드
    filename: file.name,
  });
}
```

### Step 6. Notion에 Drive 링크 저장

```typescript
// notion.ts
export async function appendDriveFilesToPage(
  pageId: string,
  files: { viewUrl: string; filename: string }[]
) {
  const blocks = files.map(f => ({
    type: 'bookmark',
    bookmark: {
      url: f.viewUrl,
      caption: [{ type: 'text', text: { content: f.filename } }],
    },
  }));
  await notion.blocks.children.append({ block_id: pageId, children: blocks });
}
```

> Drive 링크는 **북마크 블록**으로 저장 → Notion에서 자동 미리보기 (썸네일 + 제목)

---

## 5. UX 설계 (폼 측)

### 5-1. 단순 모드 (기본)

```
[📎 파일 선택]  →  [▰▰▰▰▱ 78%]  →  [✅ 업로드 완료]
                                       └─ Drive 링크 (보기/다운로드)
```

### 5-2. 다중 파일 모드 (현수막/공사현장)

```
[+ 파일 추가]  최대 10장
┌─────────────────────────────┐
│ 📷 banner1.jpg    ✓ 완료    │
│ 📷 banner2.jpg    ▰▰▰▱ 60% │
│ 📷 banner3.jpg    대기 중    │
└─────────────────────────────┘
```

### 5-3. 약력 (이중 모드)

```
[텍스트 입력] | [이미지 업로드]
   탭 1            탭 2

탭 1: <textarea> 자유 입력
탭 2: 이력서 사진 업로드 (jpg/png)
```

---

## 6. 보안 고려사항

| 항목 | 대책 |
|------|------|
| 누구나 접근 가능 링크 | 공유 권한을 "조직 내" 또는 "특정 이메일"로 제한 가능 (옵션) |
| 서비스 계정 키 유출 | Vercel 환경변수에만 보관, Git 절대 커밋 X |
| 악성 파일 업로드 | 형식 화이트리스트 (`png/jpg/pdf` 등만 허용) |
| 무제한 업로드 abuse | Rate limiting (분당 5회 제한) |

---

## 7. 예상 비용

| 항목 | 비용 |
|------|------|
| Google Cloud 프로젝트 | **무료** |
| Google Drive API 사용 | **무료** (쿼터 내) |
| Drive 저장 용량 | Workspace 플랜에 포함 (별도 구매 X) |
| **합계** | **₩0** ⭐ |

---

## 8. 장점 요약

1. ✅ **추가 비용 0원** (Workspace 보유 시)
2. ✅ **디자인팀이 가장 익숙한 도구**
3. ✅ **모바일에서도 편하게 확인** (Drive 앱)
4. ✅ **검색 강력** — 거래처명/날짜로 즉시 찾기
5. ✅ **자동 폴더 정리** — 카테고리 + 거래처별 폴더 자동 생성
6. ✅ **버전 관리 자동** — 동일 파일명 시 버전 보존
7. ✅ **Notion 임베드** — 북마크 블록으로 자동 미리보기

---

## 9. 단점 / 주의사항

1. ⚠️ Google Cloud 프로젝트 1회 설정 필요 (10분)
2. ⚠️ 서비스 계정 키 관리 필요 (1회 발급, Vercel에 보관)
3. ⚠️ Drive API 쿼터 (실제로는 절대 안 닿음)

---

## 10. 결정 필요 사항

이사님께 확인:

1. **Google Workspace 보유 여부?**
   - YES → 이 계획 그대로 진행 ✓
   - NO → 옵션 B (FTP 호스팅) 권장

2. **공유 폴더 위치 어디로 만들까요?**
   - 회사 공유 드라이브 (My Drive 외부) — 권장
   - 또는 특정 담당자 My Drive

3. **공유 권한 정책?**
   - A) 링크 있는 누구나 (간단, Notion 임베드 미리보기 작동)
   - B) 조직 내 (Workspace) 사용자만
   - C) 특정 이메일 그룹

4. **파일 정리 기준?**
   - A) 카테고리 → 거래처/날짜 (제안)
   - B) 거래처 → 카테고리
   - C) 다른 방식

---

## 11. 작업 시간 추정

| 단계 | 시간 |
|------|------|
| Google Cloud 프로젝트 + 서비스 계정 설정 | 10분 |
| Drive 폴더 생성 + 공유 | 5분 |
| API 코드 구현 | 1시간 |
| 폼 UI에 FileUpload 컴포넌트 추가 | 1시간 |
| 로컬 테스트 | 30분 |
| Vercel 환경변수 + 배포 | 15분 |
| **합계** | **약 3시간** |

---

## 12. 다음 단계

이사님께 확인 필요:
1. Google Workspace 사용 중이신지 확인
2. 사용 중이라면 어떤 플랜인지 (Business Starter/Standard/Plus)
3. 위 4개 결정 사항 답변

확인되는 대로 바로 구현 시작 가능합니다.
