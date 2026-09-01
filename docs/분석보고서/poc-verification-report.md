# POC 전체 검증 리포트 (Superpowers 방법론 적용)

검증일: 2026-04-09  
방법론: Superpowers — Verification Before Completion + Systematic Debugging  
빌드: Next.js 16.2.2 (Turbopack), Node 20.x

---

## 검증 결과 요약

| 항목 | 결과 | 증거 |
|------|------|------|
| 빌드 (`next build`) | **PASS** | `Compiled successfully`, 14 routes, exit 0 |
| TypeScript | **PASS** | `Finished TypeScript in 2.1s`, 0 errors |
| ESLint | **FAIL** | 47 errors, 2 warnings |
| 보안 | **FAIL** | timing attack, rate limiting 부재, 토큰 미설정 bypass |
| Dead Code | **FAIL** | ERASE 모드 잔재, 미사용 컴포넌트 정의 |

---

## P0 — 보안 (즉시 조치)

| # | 이슈 | 위치 | 설명 | 조치 |
|---|------|------|------|------|
| SEC-1 | **Timing Attack** | `src/lib/admin-auth.ts:13` | `auth !== Bearer ${token}` — 일반 문자열 비교로 타이밍 공격 가능 | `crypto.timingSafeEqual` 사용 |
| SEC-2 | **Rate Limiting 없음** | `src/app/api/admin/verify/route.ts` | 비밀번호 무제한 시도 가능 (brute-force) | 시도 횟수 제한 또는 딜레이 추가 |
| SEC-3 | **토큰 미설정 시 인증 bypass** | `admin-auth.ts:10`, `verify/route.ts:6-7` | `ADMIN_TOKEN` 미설정 시 모든 인증 통과 — 프로덕션에서 실수로 미설정하면 완전 노출 | 프로덕션에서 토큰 필수 검증 추가 |

---

## P1 — ESLint 에러 (47건)

### 핵심 원인 3가지

| # | 규칙 | 파일 | 건수 | 원인 | 수정 방법 |
|---|------|------|------|------|----------|
| L-1 | `react-hooks/static-components` | `new-clinic/page.tsx:991,1010` | **45건** | `SummarySection`, `SummaryItem` 컴포넌트가 **렌더 함수 내부**에 정의됨 → 매 렌더마다 재생성 | 두 컴포넌트를 모듈 스코프로 이동 |
| L-2 | `set-state-in-effect` | `page.tsx:16` | **1건** | `useEffect` 안에서 `setSavedForms()` 직접 호출 | 초기값을 `useState(() => findExistingSaves())` 형태로 변경 |
| L-3 | `@typescript-eslint/no-explicit-any` | `notion.ts:221` | **1건** | Notion SDK 타입 부재로 `as any` 사용 | `eslint-disable` 주석 추가 (불가피) |

> L-1만 수정하면 45건이 한 번에 해결됨

---

## P2 — Dead Code / 코드 정리

| # | 이슈 | 위치 | 설명 |
|---|------|------|------|
| DC-1 | **ERASE 타입 잔재** | `schedule-change/page.tsx:8` | `ActiveMode` 타입에 `'ERASE'`가 남아있지만 UI에서 설정 불가 (전체 지우기로 대체됨) |
| DC-2 | **ERASE 분기 도달 불가** | `schedule-change/page.tsx:87` | `if (activeMode === 'ERASE')` 분기 — 영원히 실행 안 됨 |
| DC-3 | **ERASE 가드 불필요** | `schedule-change/page.tsx:208` | `activeMode !== 'ERASE'` 체크 — 불필요 |
| DC-4 | **중복 router.push** | `page.tsx:26-31` | if/else 양쪽에서 동일하게 `router.push('/new-clinic')` 호출 — 조건문 자체가 의미 없음 |
| DC-5 | **eslint-disable 불필요** | `notion.ts:197` | `eslint-disable` 지시문이 있지만 해당 에러 없음 — 제거 가능 |

---

## P3 — UX / 일관성

| # | 이슈 | 위치 | 설명 |
|---|------|------|------|
| UX-1 | **summary max-w 불일치** | `summary/page.tsx:140,154` | `max-w-3xl` 사용 — 다른 페이지는 모두 `max-w-4xl` |
| UX-2 | **clinic-names fetch 에러 무시** | `schedule-change/page.tsx:59` | `.catch(() => {})` — 자동완성 실패 시 사용자 피드백 없음 |
| UX-3 | **admin `<a>` 태그 사용** | `admin/schedule/page.tsx:359,378` | `<a href="/">`를 Next.js `<Link>`로 변경 필요 (SPA 네비게이션 깨짐) |

---

## P4 — 코드 품질

| # | 이슈 | 위치 | 설명 |
|---|------|------|------|
| CQ-1 | **console.error 정보 노출** | `api/submit/route.ts:43`, `api/change/route.ts:35`, `api/schedule-change/route.ts:26` | 프로덕션 로그에 Notion API 에러 상세 노출 가능 |
| CQ-2 | **Notion `as any` 3건** | `notion.ts:58,148,221` | Notion SDK 타입 부재로 불가피하나, 래퍼 타입으로 감싸면 안전성 향상 |

---

## 수정 우선순위 (Quick Win)

| 순서 | 작업 | 난이도 | 효과 |
|------|------|--------|------|
| 1 | **L-1**: `SummarySection`/`SummaryItem` 모듈 스코프 이동 | 쉬움 | ESLint 45건 해결 |
| 2 | **DC-1~3**: ERASE 타입/분기 완전 제거 | 쉬움 | Dead code 정리 |
| 3 | **SEC-1**: `timingSafeEqual` 적용 | 쉬움 | Timing attack 방지 |
| 4 | **SEC-3**: 프로덕션 토큰 필수 검증 | 쉬움 | 인증 bypass 방지 |
| 5 | **UX-1**: summary max-w 통일 | 쉬움 | 일관성 |
| 6 | **DC-5**: 불필요 eslint-disable 제거 | 쉬움 | 경고 해소 |
| 7 | **SEC-2**: Rate limiting 추가 | 중간 | Brute-force 방지 |

---

## 검증 방법론: Superpowers 적용 결과

### 적용한 원칙

1. **Verification Before Completion**: 빌드/린트/타입체크를 실제로 실행하고 출력 확인 후 상태 판정
2. **Systematic Debugging**: ESLint 47건을 개별 분석하지 않고 root cause 3가지로 분류 → 최소 수정으로 최대 효과
3. **Evidence Before Claims**: 모든 이슈에 파일:라인 증거 첨부

### CLAUDE.md에 추가된 규칙
- 빌드/린트/타입체크 모두 통과해야 "완료"
- "should work" 금지 — 실행 결과 증거 필수
- Root cause 파악 후 수정 (증상 수정 금지)
