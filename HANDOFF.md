# 메디앤메디 거래처 폼 — 개발자 인수인계 문서

**최종 업데이트:** 2026-04-28  
**현재 상태:** 운영 중 (Production)

---

## 1. 프로젝트 개요

치과 거래처 미팅 정보 수집을 위한 Next.js 웹앱. 원장님이 폼을 작성하면 Notion DB에 저장되고 파일 첨부는 호스팅 서버에 업로드됨.

### 주요 기능
- **신규개원 폼** (`/new-clinic`) — 7단계, 파일 업로드 9종 카테고리
- **계약변경 폼** (`/contract-change`)
- **진료일정 변경** (`/schedule-change`) — 달력 UI, 태그 기반 일정 입력
- **관리자 대시보드** (`/admin/schedule`) — 비밀번호 보호, 진료일정 관리
- **요약 페이지** (`/summary`) — 제출 후 PIN으로 조회

---

## 2. 저장소 / 배포

| 항목 | 값 |
|------|-----|
| GitHub | `https://github.com/half1126-byte/mediandmedi-form` |
| Branch | `main` |
| Vercel Project | `mediandmedi-form` (Hobby plan) |
| 운영 URL | `https://mediandmedi-form-leejongkwangs-projects.vercel.app` (alias) |
| 자동 배포 | `main` push → Vercel 자동 빌드 (1~2분) |

---

## 3. 기술 스택

| 영역 | 기술 |
|------|------|
| Framework | Next.js 16.2.2 (App Router, Turbopack) |
| Runtime | Node.js 20.x |
| 언어 | TypeScript |
| 스타일 | Tailwind CSS v4 |
| 데이터 저장 | Notion API (4개 DB) |
| 파일 저장 | FTP → 자체 호스팅 (`medischedule.co.kr`) |
| 호스팅 | Vercel |

---

## 4. 환경 변수

### Vercel Production (모두 등록 완료)

```
NOTION_API_KEY              (Notion 통합 토큰 - "Needs Attention" 경고 있음, 갱신 필요할 수 있음)
NOTION_MAIN_DB_ID           (거래처 메인 DB)
NOTION_TASK_DB_ID           (팀별 업무 DB)
NOTION_CHANGE_DB_ID         (계약변경 DB)
NOTION_SCHEDULE_DB_ID       (진료일정 DB)
ADMIN_TOKEN                 (관리자 페이지 비밀번호) — 미설정 시 개발 모드, 프로덕션 필수
FTP_HOST                    medischedule.co.kr
FTP_USER                    medischedule
FTP_PASS                    (FileZilla sitemanager.xml에 base64로 저장된 값)
FTP_UPLOAD_PATH             /www/planner/uploads
FTP_PUBLIC_URL              https://medischedule.co.kr/uploads
```

> **인수자 작업:** 실제 값은 Vercel 대시보드 → Settings → Environment Variables에서 확인. `.env.local` 신규 생성 시 위 변수 모두 필요.

### 로컬 개발용 `.env.local`

`.gitignore`에 등록되어 GitHub에 안 올라감. 신규 개발자는 다음 명령으로 Vercel에서 가져올 수 있음:

```bash
npx vercel link
npx vercel env pull .env.local
```

---

## 5. 폴더 구조

```
src/
├── app/
│   ├── page.tsx                       # 홈페이지
│   ├── layout.tsx
│   ├── new-clinic/page.tsx            # 신규개원 폼 (7단계, ~1100 lines)
│   ├── contract-change/page.tsx       # 계약변경 폼
│   ├── schedule-change/page.tsx       # 진료일정 변경
│   ├── summary/page.tsx               # 요약 조회
│   ├── admin/schedule/
│   │   ├── page.tsx                   # 관리자 대시보드
│   │   └── layout.tsx                 # force-dynamic (Vercel 패키징 이슈 해결)
│   └── api/
│       ├── submit/route.ts            # 신규개원 제출
│       ├── change/route.ts            # 계약변경 제출
│       ├── schedule-change/route.ts   # 진료일정 제출
│       ├── upload/route.ts            # 파일 업로드 (FTP)
│       ├── clinic-names/route.ts      # 거래처명 자동완성
│       ├── admin/
│       │   ├── verify/route.ts        # 관리자 비밀번호 검증
│       │   ├── schedules/route.ts     # 진료일정 목록 (인증 필요)
│       │   └── schedule/[id]/route.ts # 진료일정 수정/삭제 (인증 필요)
├── components/
│   ├── FileUpload.tsx                 # 재사용 파일 업로드 컴포넌트
│   ├── ChipSelector.tsx
│   ├── CategoryChipSelector.tsx
│   ├── ContractProducts.tsx
│   ├── LoadingOverlay.tsx
│   ├── ProgressBar.tsx
│   ├── RegionCascade.tsx
│   ├── RestoreDialog.tsx
│   └── TimeSelector.tsx
├── data/
│   ├── dental.ts                      # 진료과목/장비/시설 마스터 데이터
│   ├── services.ts                    # 계약 서비스 마스터 데이터
│   └── holidays.ts                    # 한국 공휴일 (2026~2027)
└── lib/
    ├── notion.ts                      # Notion API 통합
    ├── admin-auth.ts                  # 관리자 인증 (timingSafeEqual)
    ├── autosave.ts                    # 폼 자동저장 (localStorage)
    └── team-tasks.ts                  # 팀별 업무 자동 생성
docs/                                  # 작업 이력 / 분석 문서
HANDOFF.md                             # 이 문서
CLAUDE.md                              # AI 어시스턴트 지침
AGENTS.md                              # Next.js 16 주의사항
vercel.json                            # Node 20.x 명시
```

---

## 6. 미완료 작업 (인수자 진행 필요)

### 6-1. Notion DB 신규 컬럼 추가 (필수)

신규 개원 폼에 파일 업로드 기능을 추가했으나, **Notion DB에 해당 컬럼이 없어** URL이 저장되지 않음.

거래처 메인 DB에 다음 **10개 텍스트 컬럼** 추가:

```
약력이미지
인테리어도면
로고파일
면허증
전문의자격증
사업자등록증
개설필증
간판사진
현수막사진
공사현장사진
```

> 추가 안 해도 폼은 작동 (파일 업로드 자체는 됨), URL이 Notion에 저장만 안 됨.

### 6-2. NOTION_API_KEY 갱신

Vercel 환경변수에서 `NOTION_API_KEY`에 "Needs Attention" 경고 표시됨. Notion에서 새 통합 토큰 발급 후 갱신 필요.

### 6-3. 이사님 피드백 사항 (대기 중)

`docs/director-feedback-plan.md` 참고. 신규개원 폼 전체 개편 사항 6가지 미적용:

1. Step1 의료진 동적 입력 (의료진 N명만큼 성함/직함/전문의 칸)
2. Step2 진료과목 카테고리 전면 개편 (임플란트 재료, 일반진료/턱관절/심미/소아 신설)
3. Step3 인테리어 컨셉 → Step4 이동, 임플란트 제품사 삭제
4. Step4 홍보 포인트 6개 + 로고/브랜드컬러
5. Step5 유입경로 변경, 증정선물
6. Step6 서비스 30개 (4팀)로 전면 교체

상세는 `docs/director-feedback-plan.md` + `docs/director-feedback-questions.md` 참고.

### 6-4. 보안 강화 (선택)

- `docs/poc-verification-report.md` 참고
- Rate limiting 미적용 (`/api/admin/verify`) — brute-force 가능성
- FTP가 평문 (호스팅 서버가 FTPS 미지원). SFTP 가능 여부 호스팅 회사에 문의

---

## 7. 알려진 이슈 / 주의사항

### 7-1. Next.js 16 + Vercel Turbopack 호환

- `/admin/schedule` 페이지가 `'use client'`라서 정적 빌드 시 람다 패키징 실패
- 해결: `src/app/admin/schedule/layout.tsx`에 `export const dynamic = 'force-dynamic';` 추가
- **이 layout 파일을 절대 삭제하지 마세요.** 삭제 시 Vercel 빌드 실패.

### 7-2. vercel.json `engines` 필드

- `vercel.json`에 `"engines": { "node": "20.x" }` 명시
- Vercel CLI는 이 필드를 거부 (`Schema verification failed`) → CLI deploy 시 에러
- 하지만 **GitHub 자동 배포에서는 정상 작동** (Vercel Dashboard도 받아들임)
- CLI deploy가 필요하면 `engines` 임시 제거 후 deploy → 다시 추가

### 7-3. FTP는 평문 (FTPS 미지원)

- `medischedule.co.kr` 호스팅이 TLS(FTPS) 미지원
- `src/app/api/upload/route.ts`에서 `secure: false` 사용
- 패스워드가 평문 전송됨 (Vercel ↔ 호스팅 구간)
- 보안 강화 원하면 호스팅 회사에 SFTP 활성화 문의 → `ssh2-sftp-client`로 변경

### 7-4. Windows 줄바꿈 (CRLF)

- 작업 환경이 Windows라 git이 LF→CRLF 변환 경고 출력
- 기능적 문제 없음. 무시 가능.

### 7-5. Notion API SDK `as any` 캐스팅

- `src/lib/notion.ts`에 `as any` 3곳 (line 58, 145, 220)
- Notion SDK 타입 정의 부재로 불가피
- 모두 `eslint-disable-next-line` 주석 처리됨

### 7-6. Edge Runtime 사용 불가

- `/api/upload`는 `basic-ftp`(Node.js 전용) 사용 → Edge Runtime 불가
- `export const runtime = 'nodejs';` 명시됨

---

## 8. 개발 시작 가이드

### 8-1. 로컬 환경 구축

```bash
# 1. 클론
git clone https://github.com/half1126-byte/mediandmedi-form.git
cd mediandmedi-form

# 2. 의존성 설치
npm install

# 3. Vercel 프로젝트 연결
npx vercel link
# → leejongkwangs-projects/mediandmedi-form 선택

# 4. 환경변수 가져오기
npx vercel env pull .env.local

# 5. 개발 서버 시작
npm run dev
# → http://localhost:3000
```

### 8-2. 빌드 검증

```bash
# 빌드 (Turbopack)
npm run build

# 타입체크 + 린트
npx eslint src/

# 모두 0 errors여야 정상
```

### 8-3. 배포

```bash
# 자동 배포 (권장)
git push origin main
# → Vercel이 자동으로 빌드 + 배포 (1~2분)

# 수동 배포 (CLI)
# vercel.json의 engines 필드 임시 제거 필요
npx vercel deploy --prod
```

---

## 9. 디버깅 팁

### 9-1. 로컬에서 안 되면

```bash
# 캐시 제거
rm -rf .next
npm run dev
```

### 9-2. Vercel 빌드 실패 시

- Vercel Dashboard → Deployments → 실패한 배포 클릭
- Build Logs 확인
- 가장 흔한 원인: 환경변수 누락 / TypeScript 에러

### 9-3. FTP 업로드 실패 시

- Vercel Dashboard → Logs 탭 → `/api/upload` 필터
- 흔한 에러:
  - `AUTH not understood` → `secure: true` 잘못 설정 (`secure: false`여야 함)
  - `530 Login authentication failed` → FTP_PASS 틀림
  - `EHOSTUNREACH` → FTP_HOST 오타

### 9-4. Notion 저장 실패 시

- Vercel Logs에서 `/api/submit`, `/api/change`, `/api/schedule-change` 확인
- 흔한 에러:
  - `Could not find database with ID` → DB 미공유 (Notion 통합에 DB 연결 필요)
  - `Property not found` → DB 컬럼 이름 불일치
  - `unauthorized` → NOTION_API_KEY 만료

---

## 10. 작업 이력 문서

`docs/` 폴더에 모든 분석/계획 문서 보관:

| 파일 | 내용 |
|------|------|
| `gap-analysis-medischedule.md` | 경쟁 서비스 비교 분석 |
| `full-audit-report.md` | 전체 코드 감사 |
| `superpowers-fix-log.md` | Quick Win 수정 이력 |
| `poc-verification-report.md` | POC 검증 결과 |
| `director-feedback-plan.md` | 이사님 피드백 적용 계획 |
| `director-feedback-questions.md` | 이사님 확인 요청 사항 |
| `file-upload-plan.md` | 파일 업로드 기능 설계 |
| `storage-cost-comparison.md` | 파일 저장소 비용 비교 |
| `self-hosting-analysis.md` | 자체 서버 분석 |
| `google-drive-upload-plan.md` | Google Drive 통합 계획 |
| `calendar-image-implementation.md` | 진료일정 이미지 캡처 검토 |
| `schedule-change-improvements.md` | 진료일정 페이지 개선 이력 |

---

## 11. 연락 / 문의

| 역할 | 담당 |
|------|------|
| 이사 (의사결정) | (회사 담당자) |
| 호스팅 관리 | 메디스케줄 호스팅 (`medischedule.co.kr`) |
| GitHub 소유자 | half1126-byte |
| Vercel 소유자 | leejongkwangs |

---

## 12. 인수 체크리스트

- [ ] GitHub 저장소 collaborator 추가 받기
- [ ] Vercel 팀 멤버 추가 받기
- [ ] Notion 워크스페이스 초대 받기
- [ ] Notion 통합 (Internal Integration) 토큰 발급/갱신
- [ ] 거래처 메인 DB에 신규 컬럼 10개 추가
- [ ] 로컬 환경에서 빌드 + 모든 폼 정상 작동 확인
- [ ] FTP 호스팅 SFTP 활성화 검토 (보안 강화)
- [ ] 이사님 피드백 6개 항목 적용 일정 협의

---

**최근 5개 커밋:**
```
a8f3960 chore: trigger Vercel redeploy with FTP env vars
62bf39b feat: 신규개원 폼 파일 업로드 기능 + 관리자 인증 + UI 개선 종합
0bc53ce fix: 감사 리포트 Quick Win 7건 일괄 수정
a68fe61 fix: vercel.json 추가 - Node 20.x 명시, 빌드 에러 수정
7d2ecd7 fix: admin/schedule force-dynamic layout - Vercel lambda 패키징 에러 수정
```
