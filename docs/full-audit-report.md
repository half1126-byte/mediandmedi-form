# 전체 POC 검증 리포트

검증일: 2026-04-08  
배포 상태: **Ready** (mediandmedi-form-8fht5b0iv)  
빌드: Next.js 16.2.2 (Turbopack), Node 20.x, Vercel

---

## P0 — 보안 (즉시 조치 필요)

| # | 이슈 | 위치 | 설명 |
|---|------|------|------|
| S-1 | **관리자 API 인증 없음** | `api/admin/schedules/route.ts`, `api/admin/schedule/[id]/route.ts` | GET/PATCH/DELETE 모두 인증 없이 누구나 접근 가능. 거래처 일정 데이터 전체 노출 |
| S-2 | **관리자 페이지 접근제한 없음** | `admin/schedule/page.tsx` | `/admin/schedule` 경로를 아는 사람은 누구나 접근 가능 |
| S-3 | **localStorage에 민감 정보** | `summary/page.tsx:30,35` | PIN을 localStorage에 저장 — 같은 도메인 XSS 공격 시 노출 |

### 권장 조치
- 최소한 간단한 비밀번호/토큰 인증 (환경변수 기반) 추가
- 예: API 요청 시 `Authorization: Bearer {ADMIN_TOKEN}` 헤더 검증

---

## P1 — 버그 / 기능 오류

| # | 이슈 | 위치 | 설명 |
|---|------|------|------|
| B-1 | **ABBR 객체 미사용** | `schedule-change/page.tsx:23` | `ABBR` Record 정의됐지만 렌더링에서 안 씀 (인라인 하드코딩으로 대체됨). 제거 필요 |
| B-2 | **clinic-names API 에러 무시** | `schedule-change/page.tsx:61` | `.catch(() => {})` — 거래처 목록 로드 실패 시 사용자에게 피드백 없음 |
| B-3 | **admin API 에러 무시** | `admin/schedule/page.tsx:230-243` | `updateRecord`, `deleteRecord` 에러 응답 무시. 실패해도 사용자에게 알림 없음 |
| B-4 | **PATCH body 미검증** | `api/admin/schedule/[id]/route.ts:11` | 클라이언트가 보내는 body를 검증 없이 Notion API에 전달 |
| B-5 | **Notion 클라이언트 초기화 시 env 미검증** | `lib/notion.ts:4-5` | `NOTION_API_KEY` 없으면 undefined로 Client 생성 → 런타임 에러 |
| B-6 | **연도 하드코딩** | `admin/schedule/page.tsx:290` | `[2025, 2026, 2027]` 고정 — 2028년이 되면 연도 탭 부족 |

---

## P2 — UX / 사용성

| # | 이슈 | 위치 | 설명 |
|---|------|------|------|
| U-1 | **텍스트 혼용: "거래처" vs "치과"** | `schedule-change API 에러 메시지`, `admin/page.tsx:413` | 원장님 대상 페이지에서 내부 용어 "거래처" 사용. "치과"로 통일 필요 |
| U-2 | **신규개원 스텝 2~6 유효성 검증 없음** | `new-clinic/page.tsx:328-330` | 스텝 0, 1만 검증. 스텝 2~6은 빈 값으로 다음으로 넘어갈 수 있음 |
| U-3 | **브라우저 새로고침 시 데이터 손실 경고 없음** | `new-clinic/page.tsx` | `beforeunload` 이벤트 미처리. 7단계 폼 작성 중 실수로 새로고침하면 데이터 소실 |
| U-4 | **달력 셀 h-24 고정** | `schedule-change/page.tsx:395` | 모바일에서 셀당 96px × 7열 = 칸이 좁아 태그 3개 시 텍스트 잘릴 수 있음 |
| U-5 | **WEEKDAY_LABELS 매 렌더마다 재생성** | `schedule-change/page.tsx:212` | 상수를 컴포넌트 밖으로 이동 필요 (성능) |
| U-6 | **filteredClinics 메모이제이션 없음** | `schedule-change/page.tsx:75` | 매 렌더마다 필터링 재실행. `useMemo` 권장 |
| U-7 | **max-w-2xl (672px) 너비 부족** | `new-clinic/page.tsx:279,301,315,350`, `contract-change` 동일 | 직원 피드백 F-1: PC에서 화면이 좁다 (이미 gap-analysis에 기록됨) |

---

## P3 — 코드 품질 / 유지보수

| # | 이슈 | 위치 | 설명 |
|---|------|------|------|
| C-1 | **Notion `as any` 캐스팅 3건** | `lib/notion.ts:55, 145, 217` | 타입 안전성 우회. Notion SDK 타입 정의가 부족해 불가피하나, 래퍼 함수로 감싸면 리스크 감소 |
| C-2 | **`getPageData` 미사용 export** | `lib/notion.ts:224` | 어디서도 호출되지 않음. 제거 가능 |
| C-3 | **공휴일 데이터 2028년 이후 없음** | `data/holidays.ts` | 2026-2027만 정의. 연말에 2028 데이터 추가 필요 |
| C-4 | **Autosave 디바운싱 없음** | `new-clinic/page.tsx:179` | `[data, step]` 의존성 — 매 키 입력마다 autosave 트리거. 성능 저하 |
| C-5 | **new-clinic 타입 이중 캐스팅** | `new-clinic/page.tsx:153, 172` | `as unknown as FormData`, `as unknown as Record` — 타입 안전성 우회 |
| C-6 | **접근성(a11y) 전반 부재** | 전체 페이지 | `aria-label`, `htmlFor`, `aria-required` 미사용. 스크린리더 접근 불가 |

---

## 즉시 수정 권장 (Quick Wins)

| # | 작업 | 난이도 | 예상 시간 |
|---|------|--------|----------|
| 1 | B-1: `ABBR` 미사용 객체 제거 | 쉬움 | 1분 |
| 2 | B-6: 연도 하드코딩 → `currentYear - 1 ~ +2` 동적 생성 | 쉬움 | 3분 |
| 3 | U-1: "거래처" → "치과" 텍스트 통일 | 쉬움 | 5분 |
| 4 | U-5: WEEKDAY_LABELS 모듈 스코프로 이동 | 쉬움 | 1분 |
| 5 | S-1: 관리자 API에 간단한 토큰 인증 추가 | 중간 | 30분 |
| 6 | U-3: `beforeunload` 이벤트 추가 (new-clinic) | 중간 | 10분 |
| 7 | B-5: Notion 환경변수 초기화 시 검증 | 쉬움 | 5분 |

---

## 이전 배포 장애 원인 (참고)

| 문제 | 원인 | 해결 |
|------|------|------|
| Vercel 자동 배포 실패 | Next.js 16 Turbopack + Node 24.x 호환 이슈 | `vercel.json`에 Node 20.x 명시 |
| `/admin/schedule` 람다 에러 | `'use client'` 페이지가 static으로 패키징 | `layout.tsx`에 `force-dynamic` 추가 |

---

## 총평

- **전체 기능**: 4개 폼(홈/신규개원/계약변경/진료일정) + 관리자 대시보드 정상 작동
- **보안**: 관리자 영역 인증 없음 (P0, 즉시 조치)
- **안정성**: Notion API 에러 무시 패턴 다수 (P1)
- **UX**: 원장님 대상 UI 개선 완료 (스텝 안내, 태그 강조), 일부 텍스트 혼용 남아있음
- **배포**: `vercel.json` + `layout.tsx` 추가로 안정화 완료
