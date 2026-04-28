# Superpowers 방법론 적용 — 수정 이력

적용일: 2026-04-09  
방법론: Superpowers Verification Before Completion

---

## 검증 결과 (수정 전 → 후)

| 항목 | 수정 전 | 수정 후 | 증거 |
|------|--------|--------|------|
| 빌드 | PASS | **PASS** | `Compiled successfully`, 14 routes |
| TypeScript | PASS | **PASS** | 0 TS errors |
| ESLint | **47 errors, 2 warnings** | **0 errors, 0 warnings** | `ESLINT: ALL CLEAR` |

---

## 수정 내역

### 1. L-1: SummarySection/SummaryItem 모듈 스코프 이동
- **파일:** `src/app/new-clinic/page.tsx`
- **원인:** 두 컴포넌트가 `Step7` 렌더 함수 내부에 정의 → 매 렌더마다 재생성
- **수정:** 모듈 스코프로 이동, `onGoToStep`을 props로 전달
- **효과:** ESLint 45건 해결

### 2. DC-1~3: ERASE 타입/분기 완전 제거
- **파일:** `src/app/schedule-change/page.tsx`
- **수정 내용:**
  - `ActiveMode` 타입에서 `'ERASE'` 제거 (line 8)
  - `applyModeToDate`에서 ERASE 분기 제거 (line 87)
  - `activeModeTag` 계산에서 ERASE 가드 제거 (line 208)
- **이유:** "전체 지우기" 버튼으로 대체되어 ERASE 모드 도달 불가

### 3. SEC-1: timingSafeEqual 적용
- **파일:** `src/lib/admin-auth.ts`, `src/app/api/admin/verify/route.ts`
- **수정:** `auth !== token` → `crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))`
- **이유:** 일반 문자열 비교는 타이밍 공격에 취약

### 4. SEC-3: 프로덕션 토큰 필수 검증
- **파일:** `src/lib/admin-auth.ts`, `src/app/api/admin/verify/route.ts`
- **수정:** `ADMIN_TOKEN` 미설정 시:
  - 개발 모드(`NODE_ENV !== 'production'`): 기존처럼 통과
  - 프로덕션: HTTP 500 에러 반환 (접근 차단)
- **이유:** 실수로 토큰 미설정 시 관리자 API 완전 노출 방지

### 5. UX-1: summary max-w 통일
- **파일:** `src/app/summary/page.tsx`
- **수정:** `max-w-3xl` → `max-w-4xl` (다른 페이지와 동일)

### 6. DC-4: 홈페이지 중복 로직 제거
- **파일:** `src/app/page.tsx`
- **수정:**
  - `previousSubmissions`: `useEffect` + `setState` → `useState(() => lazy init)`
  - 미사용 `savedForms` 상태 + `findExistingSaves` import 제거
  - `handleNewClinic` if/else 중복 `router.push` → 단순 호출
- **효과:** ESLint `set-state-in-effect` 에러 해소

### 7. DC-5: 불필요 eslint-disable 지시문 제거
- **파일:** `src/lib/notion.ts:197`, `src/app/admin/schedule/page.tsx`
- **수정:** 더 이상 에러가 없는 `eslint-disable` 주석 제거

### 8. UX-3: admin `<a>` → Next.js `<Link>`
- **파일:** `src/app/admin/schedule/page.tsx:358, 378`
- **수정:** `<a href="/">` → `<Link href="/">` (SPA 네비게이션 최적화)

### 9. admin verifyToken 선언 순서 수정
- **파일:** `src/app/admin/schedule/page.tsx`
- **수정:** `verifyToken`을 `useEffect` 아래에서 위로 이동 + `useCallback` 래핑
- **이유:** ESLint `immutability` 에러 — 선언 전 접근 불가

---

## 수정된 파일 목록

| 파일 | 수정 사유 |
|------|----------|
| `src/app/new-clinic/page.tsx` | L-1: SummarySection/SummaryItem 모듈 스코프 이동 |
| `src/app/schedule-change/page.tsx` | DC-1~3: ERASE dead code 제거 |
| `src/lib/admin-auth.ts` | SEC-1+3: timingSafeEqual + 프로덕션 토큰 필수 |
| `src/app/api/admin/verify/route.ts` | SEC-1+3: timingSafeEqual + 프로덕션 토큰 필수 |
| `src/app/summary/page.tsx` | UX-1: max-w 통일 |
| `src/app/page.tsx` | DC-4: 중복 로직 제거 + setState-in-effect 해소 |
| `src/lib/notion.ts` | DC-5: 불필요 eslint-disable 제거 |
| `src/app/admin/schedule/page.tsx` | UX-3: Link 교체 + verifyToken 순서 + eslint 정리 |
| `CLAUDE.md` | Superpowers 방법론 규칙 추가 |

---

## 남은 이슈 (수정 보류)

| # | 이슈 | 이유 |
|---|------|------|
| SEC-2 | Rate limiting 미적용 | `upstash/ratelimit` 등 외부 의존성 필요 — 별도 작업으로 분리 |
| CQ-1 | console.error 정보 노출 | 서버 로그이므로 프로덕션 위험도 낮음 — 추후 정리 |
| CQ-2 | Notion `as any` 3건 | SDK 타입 부재로 불가피 — eslint-disable 처리 완료 |
