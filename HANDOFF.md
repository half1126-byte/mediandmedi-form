# 메디앤메디 거래처 폼 — 개발자 인수인계 문서

**최종 업데이트:** 2026-05-29
**현재 상태:** 운영 중 (Production) — **v1.1.0** (신규개원 폼 작업범위 게이팅 개편 배포 완료)

---

## 1. 프로젝트 개요

치과 거래처 미팅 정보 수집을 위한 Next.js 웹앱. 원장님이 폼을 작성하면 Notion DB에 저장되고 파일 첨부는 호스팅 서버에 업로드됨.

### 주요 기능
- **신규개원 폼** (`/new-clinic`) — **10단계 작업범위 게이팅** (담당자가 작업범위 선택 → 안 하는 팀 섹션 자동 숨김), 파일 업로드 9종 카테고리
- **계약변경 폼** (`/contract-change`)
- **진료일정 변경** (`/schedule-change`) — 달력 UI, 태그 기반 일정 입력
- **관리자 대시보드** (`/admin/schedule`) — 비밀번호 보호, 진료일정 관리
- **요약 페이지** (`/summary`) — 제출 후 PIN으로 조회
- **AI 마케팅 플래너** (`/api/ai-planner`) — Claude로 마케팅 플랜 자동 생성

---

## 2. 저장소 / 배포

| 항목 | 값 |
|------|-----|
| GitHub | `https://github.com/half1126-byte/mediandmedi-form` |
| Branch | `main` |
| Vercel Project | `leejongkwangs-projects/mediandmedi-form` |
| 운영 URL | `https://mediandmedi-form-leejongkwangs-projects.vercel.app` (alias) |
| 연동 도메인 | `medischedule.co.kr` (form.html 임베드 / FTP 호스팅) |
| 자동 배포 | `main` 머지 → Vercel 자동 빌드 (1~2분) |

표준 배포 흐름(최근 PR #9~#11 패턴): 브랜치 → PR → `main` 머지 = 배포 트리거.

---

## 3. 기술 스택

| 영역 | 기술 |
|------|------|
| Framework | Next.js 16.2.2 (App Router, Turbopack) |
| Runtime | Node.js 20+ (`package.json` engines) |
| 언어 | TypeScript 5 / React 19.2 |
| 스타일 | Tailwind CSS v4 |
| 폼·검증 | react-hook-form 7 + zod 4 |
| 데이터 저장 | Notion API (`@notionhq/client` v5, 4개 DB) |
| AI | `@anthropic-ai/sdk` (claude-haiku) |
| 파일 저장 | FTP → 자체 호스팅 (`medischedule.co.kr`) |
| 테스트 | Vitest 4 + Testing Library + jsdom, Playwright (E2E) |
| 호스팅 | Vercel |

---

## 4. 환경 변수

### Vercel Production (모두 등록 완료)

```
NOTION_MEETING_API_KEY      (Notion 통합 토큰 - 신 워크스페이스, ★우선 사용)
NOTION_API_KEY              (Notion 통합 토큰 - 구, 폴백)
NOTION_MAIN_DB_ID           (거래처 메인 DB)
NOTION_TASK_DB_ID           (팀별 업무 DB)
NOTION_CHANGE_DB_ID         (계약변경/미팅 기록 DB)
NOTION_SCHEDULE_DB_ID       (진료일정 DB)
CLAUDE_API_KEY              (/api/ai-planner 마케팅 플랜 자동생성)
ADMIN_TOKEN                 (관리자 페이지 비밀번호) — 미설정 시 개발 모드, 프로덕션 필수
FTP_HOST                    medischedule.co.kr
FTP_USER                    medischedule
FTP_PASS                    (FTP 비밀번호)
FTP_UPLOAD_PATH             /www/planner/uploads
FTP_PUBLIC_URL              https://medischedule.co.kr/uploads
```

> **키 우선순위:** 코드(`src/lib/notion.ts`, `api/submit`)는 `NOTION_MEETING_API_KEY` → `NOTION_API_KEY` 순으로 읽음.
> **데모 모드:** 노션 키 또는 `NOTION_MAIN_DB_ID`가 없으면 `/api/submit`이 가짜 성공(`demo:true`) 반환 → 노션 없이 로컬 UI 개발 가능.
> **인수자 작업:** 실제 값은 Vercel 대시보드 → Settings → Environment Variables에서 확인.

### 로컬 개발용 `.env.local`

`.gitignore`에 등록되어 GitHub에 안 올라감. 신규 개발자는 다음으로 Vercel에서 가져옴:

```bash
npx vercel link              # → leejongkwangs-projects/mediandmedi-form 선택
npx vercel env pull .env.local
```

---

## 5. 폴더 구조

```
src/
├── app/
│   ├── page.tsx                       # 홈(폼 허브) + 하단 버전 표기
│   ├── layout.tsx
│   ├── new-clinic/page.tsx            # 신규개원 폼 (가변 10단계 게이팅 엔진, ~2000 lines) ★핵심
│   ├── contract-change/page.tsx       # 계약변경 폼
│   ├── schedule-change/page.tsx       # 진료일정 변경
│   ├── summary/page.tsx               # 요약 조회 (PIN)
│   ├── admin/schedule/
│   │   ├── page.tsx                   # 관리자 대시보드
│   │   └── layout.tsx                 # force-dynamic (Vercel 패키징 이슈 해결)
│   └── api/
│       ├── submit/route.ts            # 신규개원 제출 (createMainRecord + 팀업무)
│       ├── change/route.ts            # 계약변경 제출
│       ├── schedule-change/route.ts   # 진료일정 제출
│       ├── ai-planner/route.ts        # 마케팅 플랜 자동생성 (Claude)
│       ├── upload/route.ts            # 파일 업로드 (FTP)
│       ├── upload-calendar/route.ts   # 달력 이미지 FTP 업로드
│       └── admin/
│           ├── verify/route.ts        # 관리자 비밀번호 검증
│           ├── schedules/route.ts     # 진료일정 목록 (인증 필요)
│           └── schedule/[id]/route.ts # 진료일정 수정/삭제 (인증 필요)
├── components/                        # 공용 UI (ProgressBar 등)
├── data/
│   ├── dental.ts                      # 진료과목/장비/옵션 마스터 (폼 선택지 정본)
│   ├── services.ts                    # 계약 서비스 마스터 (팀 매핑)
│   ├── holidays.ts                    # 한국 공휴일 (2026~2027)
│   ├── regions.json                   # 시/구/동
│   └── version.ts                     # APP_VERSION/APP_UPDATED (배포 시 여기만 수정)
└── lib/
    ├── notion.ts                      # Notion API 통합 (properties/page-body 빌더) ★핵심
    ├── admin-auth.ts                  # 관리자 인증 (timingSafeEqual)
    ├── autosave.ts                    # 폼 자동저장 (localStorage)
    ├── normalize.ts                   # 거래처명 정규화·매칭
    ├── schema.ts                      # zod 스키마
    └── team-tasks.ts                  # 팀별 업무 자동 생성
docs/                                  # 작업 이력 / 분석 / 질문 정본 문서
HANDOFF.md                             # 이 문서
CLAUDE.md                              # AI 어시스턴트 지침 + Superpowers 방법론
AGENTS.md                              # Next.js 16 주의사항
vercel.json                            # framework/build/install 지정
```

---

## 6. 노션 연동 구조 (가장 중요)

핵심은 `src/lib/notion.ts`.

### 연결되는 노션 DB
| 역할 | 환경변수 | 생성 함수 |
|------|----------|-----------|
| 거래처DB (신규개원) | `NOTION_MAIN_DB_ID` | `createMainRecord` |
| 대시보드 업무 (팀별) | `NOTION_TASK_DB_ID` | `createTaskRecord` |
| 미팅 기록 (계약변경) | `NOTION_CHANGE_DB_ID` | `createChangeRecord` |
| 진료일정 | `NOTION_SCHEDULE_DB_ID` | `createScheduleChangeRecord` |
| (구) 거래처 DB | 하드코딩 `LEGACY_CLINICS_DB_ID` | relation 검색용 (`findClinicByName`) |

### ⭐ 절대 규칙: 노션 DB 스키마(컬럼) 변경 금지 (동훈님 지침)

신규 필드는 **전부 페이지 본문 블록**으로 저장한다. (이전 "파일용 컬럼 10개 추가" 계획은 폐기됨)

`createMainRecord(formData)` → 거래처DB에 **새 페이지 1개** 생성, 한 번의 `pages.create`로 처리:

1. **`buildMainProperties(data)`** → 페이지 **속성**(기존 DB 컬럼 약 35개).
   - ⚠️ 여기 컬럼명은 DB에 실제 존재해야 함. 없는 이름을 넣으면 **노션이 요청 전체를 거부 → 제출 실패.** **컬럼 추가/이름변경 금지.**
2. **`buildMainPageChildren(data)`** → 페이지 **본문 블록**(heading + bullet). 작업범위·의료진·진료·시설·브랜딩·마케팅·홈페이지/웹·디자인/브랜딩·계약·첨부.
   - 파일 업로드 URL(`collectFiles`)과 신규 항목은 전부 여기 저장.
3. 계약 서비스가 있으면 `team-tasks.ts`가 팀별(마케팅/바이럴/디자인/웹) 업무를 `대시보드 업무 DB`에 생성하고 거래처 페이지를 relation으로 연결.

> **새 필드를 노션에 담으려면** → `buildMainPageChildren`에 `bullet()` 한 줄 추가. **`buildMainProperties`는 건드리지 말 것.**
> 노션 매핑 테스트: `test/lib/notion.test.ts` (mock 클라이언트로 실제 쓰기 없이 페이로드 검증). 저장 필드 바꾸면 여기 단언도 갱신.

### 신규개원 폼 엔진 (`src/app/new-clinic/page.tsx`)

- `STEP_REGISTRY: StepDef[]` — 각 스텝을 `{ id, label, timeMin, visible(d), validate?(d) }`로 선언.
  - StepId: `basic | scope | medical | facility | branding | marketing | web | design | contract | review`
- `activeSteps = STEP_REGISTRY.filter(s => s.visible(data))` — **작업범위(scope)** 에 따라 보일 스텝만 동적 계산.
  - `web` 스텝 `visible: d => d.scope.web` / `design` 스텝 `d => d.scope.logo || d.scope.video`
- 현재 위치는 **`stepId`(StepId) state가 정본**, 인덱스는 파생 → 게이팅해도 인덱스 표류 없음.
- `FormData.scope = { marketing, viral, web, logo, video }` (담당자가 Step 2에서 설정).
- 자동저장: `autosave.ts`가 localStorage 저장. 복원 시 `handleRestore` 키단위 병합 + 구버전은 `inferScope`로 작업범위 추론.
- 질문 정본 문서: `docs/신규개원-질문-합본.md`.

---

## 7. 미완료 / 운영 작업 (인수자 진행)

### 7-1. 호스팅 서버 파일 정리 (운영)
업로드 파일은 **자동 삭제 안 됨.** 누적 시 디스크 모니터링 필요:
- 위치: `medischedule.co.kr`의 `/www/planner/uploads/`
- 구조: `{category}/{clinicName}_{YYYY-MM-DD}/{timestamp}-{filename}`
- 정리: FileZilla 접속 → 오래된 폴더 수동 삭제 (추후 cron 검토)

### 7-2. NOTION_API_KEY 상태 확인
구 `NOTION_API_KEY`에 "Needs Attention" 경고가 있었음. 현재는 `NOTION_MEETING_API_KEY`(신 워크스페이스)가 우선이지만, 폴백 키 만료 여부 확인 권장.

### 7-3. 알려진 보안 한계 (인지 후 사용)

**적용된 보안:**
- `/api/admin/verify` — IP별 5회/분 실패 시 60초 차단 (in-memory rate limit)
- `/api/upload` — 카테고리 화이트리스트(path traversal 방지), Content-Length 검증(50MB), 형식/크기 검증
- 관리자 토큰 — `crypto.timingSafeEqual` (timing attack 방지), 프로덕션 `ADMIN_TOKEN` 미설정 시 admin API 500
- CORS — `medischedule.co.kr` 오리진만 허용 (wildcard 제거됨)

**미해결(운영 중 인지):**
1. `/api/upload`는 인증 없는 공개 엔드포인트 — 추후 세션 토큰/CAPTCHA 권장
2. FTP 평문 전송 — 호스팅 FTPS 미지원. SFTP 활성화 문의 권장
3. Admin 토큰 sessionStorage 보관 — XSS 시 탈취 가능(내부 직원만 접근)
4. Admin PATCH/DELETE는 임의 page ID 허용 — schedule DB 소속 사전 검증 권장
5. PIN은 4자리 `Math.random()` — 인증 아닌 편의 기능, 민감정보 조회 금지
6. 공휴일 2026~2027만 하드코딩 — 2028 진입 시 `src/data/holidays.ts` 갱신

---

## 8. 알려진 이슈 / 주의사항

### 8-1. Next.js 16 + Vercel Turbopack
- `/admin/schedule`가 `'use client'`라 정적 빌드 시 람다 패키징 실패 → `src/app/admin/schedule/layout.tsx`에 `export const dynamic = 'force-dynamic';`로 해결. **이 layout 삭제 금지.**

### 8-2. Node 버전 / vercel.json
- Node 요구는 `package.json`의 `engines.node >= 20`으로 관리.
- `vercel.json`은 `framework/buildCommand/installCommand`만 지정(engines 필드 없음).

### 8-3. FTP 평문 (FTPS 미지원)
- 호스팅이 TLS 미지원 → `api/upload`·`api/upload-calendar`에서 `secure: false`. SFTP 원하면 호스팅사에 문의 후 `ssh2-sftp-client`로 교체.

### 8-4. Edge Runtime 불가
- `basic-ftp`(Node 전용) 사용 라우트는 `export const runtime = 'nodejs';` 명시.

### 8-5. Windows 줄바꿈 (CRLF)
- 작업 환경 Windows라 git LF→CRLF 경고 출력. 기능 문제 없음.

### 8-6. Notion SDK `as any`
- `src/lib/notion.ts`에 SDK 타입 부재로 `as any` 몇 곳 + `eslint-disable` 주석. 불가피.

### 8-7. "빈 속성 숨기기"는 API로 못 켬
- 거래처DB 페이지에 빈 컬럼이 많이 보이면 노션 UI에서: 페이지 → `···` → `속성 사용자 지정` → `빈 속성 숨기기` 토글. (코드/배포로 불가능, 수동)

---

## 9. 개발 시작 가이드

```bash
# 1. 클론 + 설치
git clone https://github.com/half1126-byte/mediandmedi-form.git
cd mediandmedi-form
npm install

# 2. 환경변수 (Vercel에서 가져오기)
npx vercel link
npx vercel env pull .env.local

# 3. 개발 서버
npm run dev          # http://localhost:3000
```

### 검증 (완료 기준 — CLAUDE.md 규칙)
```bash
npx tsc --noEmit     # 타입체크
npm run lint         # ESLint
npm run test         # Vitest (현재 87 tests 통과)
npm run build        # 프로덕션 빌드
# 4개 모두 통과해야 "완료". "should work" 금지.
```

### 배포
```bash
git checkout -b fix/xxx
# ...작업 + 위 검증 통과...
git add -u && git commit -m "fix: ..."
git push -u origin fix/xxx
gh pr create --base main --title "..." --body "..."
gh pr merge <PR#> --merge --delete-branch    # 머지 = 배포

# 배포 상태 확인
gh api repos/half1126-byte/mediandmedi-form/commits/<sha>/status \
  --jq '.state, (.statuses[]? | "\(.context): \(.state)")'   # Vercel: success
```

---

## 10. 디버깅 팁

- **로컬 안 되면:** `rm -rf .next && npm run dev`
- **Vercel 빌드 실패:** Dashboard → Deployments → Build Logs (흔한 원인: 환경변수 누락 / TS 에러)
- **FTP 업로드 실패:** Logs `/api/upload` — `AUTH not understood`(secure 설정), `530`(FTP_PASS), `EHOSTUNREACH`(FTP_HOST)
- **Notion 저장 실패:** Logs `/api/submit|change|schedule-change` — `Could not find database`(DB 미공유), `Property not found`(컬럼명 불일치), `unauthorized`(키 만료)
- **거래처명 매칭 실패:** 계약변경/일정변경은 `normalize.ts`로 정규화해 기존 페이지 relation 연결. 표기 다르면 매칭 실패.

---

## 11. 작업 이력 문서 (`docs/`)

| 파일 | 내용 |
|------|------|
| `신규개원-질문-합본.md` | **신규개원 폼 질문 정본** (브랜딩 인터뷰 + 앱 폼 10단계) |
| `director-feedback-plan.md` / `director-feedback-questions.md` | 이사님 피드백 계획·질문 (v1.1.0에서 반영 완료) |
| `full-audit-report.md` / `superpowers-fix-log.md` | 코드 감사 / 수정 이력 |
| `poc-verification-report.md` | POC 검증 |
| `file-upload-plan.md` / `storage-cost-comparison.md` | 파일 업로드·저장소 검토 |
| `calendar-image-implementation.md` / `schedule-change-improvements.md` | 진료일정 관련 |

> v1.1.0 개편 계획 원본: `C:\Users\com\.claude\plans\purring-growing-snail.md` (로컬, 신규개원 폼 게이팅+중복통합 3-PR 플랜)

---

## 12. 연락 / 인수 체크리스트

| 역할 | 담당 |
|------|------|
| GitHub 소유자 | half1126-byte |
| Vercel 소유자 | leejongkwangs |
| 호스팅 | 메디스케줄 (`medischedule.co.kr`) |

### 권한
- [ ] GitHub collaborator / Vercel 멤버 / Notion 워크스페이스 / FTP 계정 받기

### 환경 검증
- [ ] `git clone` + `npm install` + `npx vercel env pull .env.local`
- [ ] `npm run dev` → 모든 폼 정상 표시
- [ ] 신규개원 제출 → 거래처DB에 페이지 생성 + (작업범위에 따라) 본문 섹션 노출 확인
- [ ] 파일 업로드 1개 → FileZilla로 호스팅 서버 실제 파일 확인
- [ ] `/admin/schedule` 진입 확인
- [ ] `npx tsc --noEmit` · `npm run lint` · `npm run test` · `npm run build` 모두 통과

### 운영 점검
- [ ] Vercel 환경변수 전부 설정 (Notion 6 + Claude 1 + Admin 1 + FTP 5)
- [ ] 폴백 `NOTION_API_KEY` 만료 여부 확인
- [ ] 호스팅 `/www/planner/uploads/` 디스크 모니터링

### 인수 후 우선 작업 (P0)
- [ ] FTP → SFTP 활성화 호스팅사 문의
- [ ] `/api/upload` 인증(세션 토큰/CAPTCHA) 검토

---

**최근 커밋 (git log --oneline 참고):**
```
e20899f Merge #11: 공휴일 휴진 노션 저장 누락 수정 + eslint 정리
987b0a4 Merge #10: 버전 1.1.0 (신규개원 폼 게이팅 + 중복질문 통합)
f9c6af1 Merge #9: dedup + 웹퍼블 신규 필드
99d5997 security: CORS origin 제한 (wildcard → medischedule.co.kr)
bf2f487 perf: AI 플래너 모델 claude-haiku-4-5 전환
```
