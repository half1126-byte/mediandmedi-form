# 파일 스토리지 비용 비교 — 무료 우선

작성일: 2026-04-09  
조건: Vercel Pro 비용 부담 회피, 50GB까지 저장 가능

---

## 1. 결론 먼저

> **Cloudflare R2가 압도적으로 저렴** — 10GB까지 영구 무료, 그 이후도 매우 저렴

| 솔루션 | 50GB 저장 시 월 비용 | 영구 무료 한도 |
|--------|--------------------|---------------|
| **Cloudflare R2** ⭐ | **약 ₩1,000** | **10GB + 무제한 다운로드** |
| Vercel Blob (Hobby) | 사용 불가 | 1GB만 무료 |
| Vercel Blob (Pro) | ₩28,000 | 없음 (Pro 플랜 가입 필요) |
| AWS S3 Seoul | 약 ₩13,000 | 5GB (12개월만) |
| NaverCloud Object Storage | 약 ₩11,000 | 없음 |

---

## 2. Cloudflare R2 상세

### 가격 (2026년 기준)

| 항목 | 비용 |
|------|------|
| 저장 | $0.015/GB/월 (~₩20/GB/월) |
| Class A 작업 (업로드) | $4.50/백만 회 |
| Class B 작업 (다운로드) | $0.36/백만 회 |
| **외부 전송 (egress)** | **$0 (무료!)** ⭐ |

### 무료 한도 (영구)

- 저장: **10 GB**
- Class A 작업: 백만 회/월 (업로드 100만 번)
- Class B 작업: 천만 회/월 (다운로드 1천만 번)
- **외부 전송: 무제한 무료** ⭐

### 우리 사용량 추정

| 시나리오 | 저장 | 비용 |
|---------|------|------|
| 1년 30곳 (~1.5GB) | 1.5GB | **₩0 (무료)** |
| 1년 100곳 (~5GB) | 5GB | **₩0 (무료)** |
| 1년 200곳 (~10GB) | 10GB | **₩0 (무료)** |
| 1년 500곳 (~25GB) | 25GB | 25 × ₩20 = **약 ₩500/월** |
| 1년 1000곳 (~50GB) | 50GB | 50 × ₩20 = **약 ₩1,000/월** |

> **사실상 1년 200곳까지 무료**, 그 이후도 매우 저렴.

### 장점

1. **외부 전송 무료** — 사용자가 파일 다운로드해도 추가 비용 0
2. **10GB 영구 무료** — 시간 제한 없음
3. **S3 호환 API** — AWS S3 SDK 그대로 사용 가능
4. **CDN 자동 적용** — 전 세계에서 빠르게 접근

### 단점

1. 결제: 신용카드 (해외 결제) 필요 — 세금계산서 발급 가능
2. 한국어 고객지원 약함
3. Vercel과 통합도가 낮음 (코드 몇 줄 추가만 필요)

---

## 3. 다른 무료 한도 옵션

### AWS S3 Free Tier (12개월만)
- 5GB 저장 + 20,000 GET + 2,000 PUT
- **12개월 후 유료 전환** → 장기적으로 부적합

### Backblaze B2
- 10GB 저장 무료
- 외부 전송: 매월 저장한 양의 3배까지 무료
- 가격: $0.005/GB/월 (R2의 1/3)
- **R2와 비슷한 옵션, 더 저렴**

### 무료 한도 비교

| 솔루션 | 영구 무료 저장 | 영구 무료 전송 |
|--------|--------------|--------------|
| **Cloudflare R2** | 10 GB | **무제한** |
| **Backblaze B2** | 10 GB | 저장량 × 3/월 |
| AWS S3 | 5 GB (12개월만) | 100 GB (12개월만) |
| Vercel Blob | 1 GB | 1 GB/월 |
| NaverCloud | 0 | 0 |

---

## 4. 권장 구현: Cloudflare R2

### 4-1. 가입 + 설정 (5분)

1. https://dash.cloudflare.com 가입
2. R2 활성화 (신용카드 등록 필수, 결제는 사용량 초과 시만)
3. Bucket 생성 (예: `mediandmedi-files`)
4. API Token 생성 → Access Key ID + Secret Access Key 발급

### 4-2. 패키지 설치

```bash
npm install @aws-sdk/client-s3
```

### 4-3. 환경변수 (.env.local 및 Vercel)

```
R2_ACCOUNT_ID=xxx
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET_NAME=mediandmedi-files
R2_PUBLIC_URL=https://files.mediandmedi.co.kr  (커스텀 도메인 또는 Cloudflare 기본 URL)
```

### 4-4. 업로드 API (`src/app/api/upload/route.ts`)

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get('file') as File;
  const category = formData.get('category') as string;

  // 검증
  const MAX_SIZE = 30 * 1024 * 1024; // 30MB
  if (file.size > MAX_SIZE) {
    return Response.json({ error: '파일 크기 초과 (최대 30MB)' }, { status: 400 });
  }

  const key = `${category}/${Date.now()}-${file.name}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  await r2.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
    Body: buffer,
    ContentType: file.type,
  }));

  const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;
  return Response.json({ url: publicUrl, filename: file.name });
}
```

### 4-5. Cloudflare R2 공개 URL 설정 (한 번만)

**옵션 A: Cloudflare 기본 URL (가장 간단)**
- Cloudflare Dashboard → R2 → 버킷 선택 → "Public Access" 활성화
- URL: `https://pub-{account_id}.r2.dev/{key}` 자동 생성

**옵션 B: 커스텀 도메인 (회사 도메인 사용)**
- `files.mediandmedi.co.kr` 도메인을 R2 버킷에 연결
- HTTPS 자동 적용
- URL: `https://files.mediandmedi.co.kr/{key}`

### 4-6. Notion에 URL 저장 (기존 코드 그대로)

```typescript
// notion.ts에 추가 (file-upload-plan.md와 동일)
export async function appendFilesToPage(pageId: string, files: { url: string }[]) {
  const blocks = files.map(f => ({
    type: 'image',
    image: { type: 'external', external: { url: f.url } }
  }));
  await notion.blocks.children.append({ block_id: pageId, children: blocks });
}
```

---

## 5. 비용 시뮬레이션 (3년 운영 시)

### 시나리오: 매년 100곳씩 누적, 5MB 평균 다운로드

| 연차 | 누적 저장 | 월 다운로드 | R2 월 비용 | Vercel Pro 월 비용 |
|------|---------|-----------|-----------|-----------------|
| 1년차 | 5GB | 50GB | **₩0** | ₩28,000 |
| 2년차 | 10GB | 100GB | **₩0** | ₩28,000 |
| 3년차 | 15GB | 150GB | **₩100** | ₩28,000 |

**3년 누적 비용:**
- **Cloudflare R2: 약 ₩1,200**
- **Vercel Pro: ₩1,008,000** (1백만 원 차이)

---

## 6. 마이그레이션 시 주의사항

기존 Vercel Blob 사용 중이라면:

1. R2로 마이그레이션은 1회성 작업
2. 기존 파일을 R2로 복사 후 Notion URL 일괄 변경 (스크립트 작성)
3. 약 1~2시간 작업

---

## 7. 결정

**비용 최우선이라면 Cloudflare R2 강력 권장:**
- 10GB까지 영구 무료
- 다운로드 무제한 무료
- 1년 200곳까지 추가 비용 0원
- S3 호환 API → 추후 다른 서비스로 이전 쉬움

**한국 회사 + 세금계산서 필요하다면:**
- NaverCloud Object Storage (월 ₩11,000)

**결제 어렵거나 회사 IT 담당자 있다면:**
- 카페24 등 한국 호스팅 + SFTP (월 ₩10,000)

---

## 8. 결정 필요

이사님께 확인:

1. **Cloudflare R2 사용 가능?** (해외 신용카드 결제 가능 여부)
   - 가능 → R2 권장 (사실상 무료)
   - 불가능 → NaverCloud Object Storage 권장

2. **회사 도메인을 파일 호스팅에 사용 가능?**
   - 예: `files.mediandmedi.co.kr` 같은 서브도메인
   - 가능하면 더 신뢰감 있는 URL 사용 가능
   - 불가능해도 R2 기본 URL로 충분히 동작
