# 자체 서버 배포 분석 — Vercel vs 자체 호스팅

작성일: 2026-04-09  
질문: Vercel Blob 대신 회사 자체 서버(FTP/FileZilla)에 파일 저장 가능한가?

---

## 1. 전제 정리

"FileZilla로 우리 서버에 배포" 의미를 두 가지로 해석 가능:

### 해석 A: Next.js 앱은 Vercel 유지, **파일만** 자체 서버
```
브라우저 → Vercel (Next.js) → /api/upload → SFTP → 자체 서버 → public URL
                                                            ↓
                                                      Notion에 URL 저장
```

### 해석 B: Next.js 앱과 파일 모두 자체 서버
```
브라우저 → 자체 서버 (Next.js + 파일 저장) → 동일 서버 안에서 처리
```

---

## 2. 현실적 옵션 4가지

### 옵션 1: 한국 호스팅 회사 (카페24/가비아/닷홈)

```
업로드 → SFTP → 호스팅 서버의 public_html 폴더 → https://yoursite.com/uploads/file.pdf
```

| 항목 | 내용 |
|------|------|
| 비용 | 월 5,000~50,000원 |
| 용량 | 10~500GB |
| 트래픽 | 월 100GB~무제한 |
| HTTPS | Let's Encrypt 무료 (호스팅에서 1-click 설치) |
| FTP/SFTP | O (대부분 지원) |
| 운영 부담 | **낮음** — 호스팅 회사가 서버 관리 |

**장점:**
- 가격 예측 가능
- 한국어 고객지원
- 결제 편함 (세금계산서)

**단점:**
- 동시접속 한도 (저렴한 플랜은 100명~)
- 트래픽 초과 시 추가 과금
- SSD 속도 느릴 수 있음

---

### 옵션 2: 클라우드 오브젝트 스토리지 (NaverCloud / AWS S3)

```
업로드 → S3 SDK → 클라우드 스토리지 → public CDN URL
```

| 서비스 | 저장 비용 | 전송 비용 | 비고 |
|--------|----------|----------|------|
| **NaverCloud Object Storage** | ~₩40/GB/월 | ~₩90/GB | 한국 회사, 결제 편함 |
| **AWS S3 (Seoul)** | ~₩30/GB/월 | ~₩117/GB | 글로벌 표준, 안정적 |
| **Cloudflare R2** | ~$15/100GB/월 | **무료** | 트래픽 무료가 강점 |

**예상 비용 (50GB 저장 + 월 100GB 다운로드):**
- NaverCloud: **월 ₩11,000** (₩2,000 저장 + ₩9,000 트래픽)
- AWS S3: **월 ₩13,200** (₩1,500 저장 + ₩11,700 트래픽)
- Cloudflare R2: **월 $7.5** (약 ₩10,000, 트래픽 무료)
- **Vercel Blob (Pro 플랜)**: **무료** (월 100GB까지)

**장점:**
- 사실상 무제한 용량
- 안정성 99.99%
- CDN 자동 적용 가능

**단점:**
- 신용카드 결제 (해외)
- API 키 관리 필요

---

### 옵션 3: VPS + 직접 구축 (AWS Lightsail / NaverCloud Server)

```
원장님 → Next.js 앱 (VPS) → /api/upload → 같은 서버 디스크 저장 → URL 제공
```

| 항목 | AWS Lightsail | NaverCloud Compact |
|------|--------------|---------------------|
| 월 비용 | $5~$20 (₩7,000~28,000) | ₩9,000~40,000 |
| 디스크 | 40~80GB SSD | 50~100GB SSD |
| 트래픽 | 월 1~5TB 포함 | 월 100GB 포함 |
| HTTPS | Let's Encrypt 직접 설정 | 동일 |
| 운영 부담 | **높음** — 서버 관리 직접 |

**장점:**
- 가격 저렴
- Next.js 앱과 파일 한 곳에 통합 가능
- 데이터 완전 통제

**단점:**
- **운영 부담 큼**: OS 업데이트, 보안 패치, 백업, 모니터링 직접
- 서버 다운 시 폼 전체 마비
- 한국 IP에서만 빠름 (글로벌 사용자 느림)

---

### 옵션 4: 사내 NAS / 사내 서버

```
업로드 → 회사 서버 → 사내 네트워크 디스크
```

| 항목 | 내용 |
|------|------|
| 비용 | 초기 NAS 구매 (₩50~200만원), 월 비용 거의 없음 |
| 용량 | NAS 용량만큼 (4TB~) |
| 운영 부담 | **매우 높음** — 외부 접근 위해 공유기 포트포워딩, 도메인, HTTPS, 백업 |
| 추천도 | ❌ **비추천** |

**이유:**
- 외부에서 접근 가능하게 설정 = **보안 위험**
- 사무실 인터넷이 가정용이면 업로드 속도 느림
- 정전/장비고장 시 데이터 손실 위험
- HTTPS 인증서 관리 어려움

---

## 3. FTP vs SFTP vs HTTP API 보안 비교

| 프로토콜 | 보안 | 우리 사용 가능? |
|---------|------|---------------|
| **FTP (FileZilla 기본)** | ❌ 평문 전송 (비밀번호 노출) | 절대 사용 금지 |
| **SFTP (FileZilla로 SSH 접속)** | ✅ 암호화 | 가능 |
| **FTPS (FileZilla로 TLS)** | ✅ 암호화 | 가능 |
| **HTTP REST API (S3 SDK)** | ✅ HTTPS | **가장 권장** |

> **결론: "FileZilla = FTP" 그대로 쓰면 보안 위험 큼.** SFTP 또는 S3 호환 API로 변경 권장.

---

## 4. 비용 비교 종합 (1년 100곳 거래처 기준)

| 옵션 | 월 비용 | 연 비용 | 운영 부담 | 신뢰성 |
|------|--------|--------|----------|--------|
| **Vercel Blob (현재 권장)** | ₩0 (Hobby 1GB) ~ ₩28,000 (Pro 100GB) | ₩0 ~ ₩336,000 | 매우 낮음 | 높음 |
| **NaverCloud Object Storage** | ₩11,000 | ₩132,000 | 낮음 | 높음 |
| **AWS S3 Seoul** | ₩13,000 | ₩156,000 | 낮음 | 매우 높음 |
| **Cloudflare R2** | ₩10,000 | ₩120,000 | 낮음 | 높음 |
| **카페24 호스팅** | ₩10,000~30,000 | ₩120,000~360,000 | 낮음 | 보통 |
| **AWS Lightsail VPS** | ₩7,000 | ₩84,000 | **높음** | 보통 |
| **사내 NAS** | ₩0 (전기료) | ₩0~50,000 | **매우 높음** | 낮음 |

---

## 5. 권장 의사결정 순서

```
1. 회사가 이미 자체 서버/호스팅 보유?
   ├─ YES → 옵션 3 (VPS) 또는 옵션 1 (호스팅) 검토
   └─ NO  ↓

2. 데이터 통제권이 매우 중요? (보안/감사 이슈)
   ├─ YES → 옵션 2 (NaverCloud Object Storage) — 한국 회사 + 클라우드
   └─ NO  ↓

3. 비용 최소화?
   ├─ YES → Vercel Blob (현재 권장) — 무료 한도 충분
   └─ NO  → Vercel Blob 또는 Cloudflare R2

```

---

## 6. 권장안: 두 가지 시나리오

### 시나리오 A: 비용 최소화 (현재 상황)
```
파일 호스팅: Vercel Blob (Pro 플랜)
앱 호스팅: Vercel
→ 월 추가 비용 ₩0
```

### 시나리오 B: 데이터 통제 + 한국 회사 선호
```
파일 호스팅: NaverCloud Object Storage (한국 데이터센터)
앱 호스팅: Vercel 유지 (또는 NaverCloud Server로 이전)
→ 월 ₩11,000 ~ ₩40,000
```

> **FileZilla(FTP) 직접 운영은 비추천.** 보안 위험 + 운영 부담 큼.  
> 같은 "자체 서버" 컨셉이라면 **NaverCloud Object Storage**가 한국 회사 + 안정성 + S3 호환 API로 가장 실용적.

---

## 7. 만약 그래도 자체 서버 + SFTP로 가야 한다면 (해석 A)

### 구현 (Next.js → SFTP 업로드)

```bash
npm install ssh2-sftp-client
```

```typescript
// /api/upload/route.ts
import Client from 'ssh2-sftp-client';

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get('file') as File;
  const buffer = Buffer.from(await file.arrayBuffer());

  const sftp = new Client();
  await sftp.connect({
    host: process.env.SFTP_HOST,
    port: 22,
    username: process.env.SFTP_USER,
    password: process.env.SFTP_PASS, // 또는 privateKey 사용 권장
  });

  const remotePath = `/uploads/${Date.now()}-${file.name}`;
  await sftp.put(buffer, remotePath);
  await sftp.end();

  // 파일 접근 URL (호스팅 회사가 https://yoursite.com/uploads/ 로 매핑)
  return Response.json({ url: `https://yoursite.com${remotePath}` });
}
```

### 필수 인프라

| 항목 | 비고 |
|------|------|
| SFTP 서버 | 호스팅 회사 또는 VPS |
| 도메인 + HTTPS | 파일 접근 URL용 (Notion에서 외부 URL로 임베드) |
| 디스크 공간 | 1년 사용량 50~80GB |
| 정적 파일 서빙 | nginx/Apache 설정 — `/uploads/` 경로 공개 |
| 보안 헤더 | `X-Content-Type-Options: nosniff`, `Content-Disposition: attachment` (옵션) |

### 환경변수 (Vercel에 추가)
```
SFTP_HOST=your-server.com
SFTP_USER=upload-bot
SFTP_PASS=강력한비밀번호
```

### 단점
- SFTP 연결 실패 시 업로드 실패 → 재시도 로직 필요
- VercelEdge Runtime에서 ssh2 안 됨 → Node.js Runtime만 가능 (구현 무관하나 알아둘 것)
- 서버 다운 시 폼 전체 영향

---

## 8. 결론

### 가장 실용적: **Vercel Blob 그대로 (변경 없음)**
- 비용 0원
- 운영 부담 0
- 1000곳까지 무료 한도 내

### "회사 자체 통제" 원하시면: **NaverCloud Object Storage**
- 한국 회사
- S3 호환 API (Vercel Blob과 코드 거의 동일)
- 월 1~4만원

### "FTP/SFTP 직접 운영" 원하시면: **VPS + SFTP**
- 가능하나 비추천
- 보안/백업/HTTPS 모두 직접 책임
- 월 1~3만원이지만 운영 시간 비용이 더 큼

---

## 9. 결정 필요

이사님께 확인:

1. **어떤 이유로 자체 서버를 고려하시는지?**
   - 비용 절감? → Vercel Blob 무료가 더 저렴
   - 데이터 통제? → NaverCloud Object Storage 권장
   - 회사 정책? → 정책 상세 확인 필요

2. **기존 자체 서버/호스팅 보유 여부?**
   - 있다면 사양/용량/계정 정보 확인 필요

3. **운영 인력?**
   - 사내 개발자/IT 담당자 상시 대응 가능 여부
   - 없다면 Vercel Blob 또는 NaverCloud Object Storage가 안전
