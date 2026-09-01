# 진료일정 변경 수정사항 정리

작성일: 2026-04-08

---

## 완료된 수정사항

### 1. 레이아웃 변경 (완료)
- **제목**: "진료일정 전달" → "진료일정 변경"
- **레이아웃**: 좌/우 2컬럼 → 1컬럼 (추가정보가 달력 아래)
- **폭**: `max-w-4xl` (896px), 신규개원/계약변경과 동일
- **하단 고정 버튼 제거**: 제출 버튼이 폼 하단에 통합

### 2. 전체 지우기 버튼 (완료)
- **기존**: 날짜별 개별 삭제 모드 (ERASE 모드)
- **변경**: 한 번 클릭으로 달력 전체 일정 초기화 (confirm 확인 후)

### 3. 라벨 문구 통일 (완료)
| 전 | 후 |
|---|---|
| 다음 달 이벤트 (선택) | **다음 달 이벤트 내용이 있다면 알려 주세요** |
| 출력 사이즈 (해당하는 것 모두 선택) | **출력 사이즈를 선택해 주세요** |
| 기타 요청사항 (선택) | **기타 요청사항이 있으시다면 알려 주세요** |

### 4. 관리자 페이지 hydration 에러 수정 (완료)
- `<button>` 안에 `<button>` → 외부를 `<div role="button">`으로 변경
- 좌측 패널: `w-[380px]` → `w-[480px]`
- 우측 상세: `max-w-2xl` → `max-w-4xl`

### 5. 관리자 인증 (완료)
- 환경변수 `ADMIN_TOKEN`으로 비밀번호 설정
- API 3개 라우트에 토큰 검증 미들웨어 적용
- 관리자 페이지 진입 시 비밀번호 게이트 UI
- sessionStorage로 세션 유지

### 6. 전체 화면 비율 확대 (완료)

| 페이지 | 전 | 후 |
|--------|---|---|
| `/new-clinic` | `max-w-2xl` (672px) | `max-w-4xl` (896px) |
| `/contract-change` | `max-w-2xl` (672px) | `max-w-4xl` (896px) |
| `/schedule-change` | `max-w-5xl` (1024px) | `max-w-4xl` (896px, 1컬럼) |
| `/summary` | `max-w-lg` (512px) | `max-w-3xl` (768px) |
| `/admin/schedule` 좌측 | `w-[380px]` | `w-[480px]` |
| `/admin/schedule` 우측 | `max-w-2xl` | `max-w-4xl` |

---

## 추가 검토 요청: 달력 이미지 노션 저장

### 요구사항
진료일정 제출 시 달력 상태를 **이미지로 캡처**하여 Notion 페이지에 첨부

### 기술 검토 결과

#### Notion API 제약
- Notion API는 **직접 파일 업로드를 지원하지 않음** (이미지 블록)
- 이미지 블록은 `external URL`만 허용 → 이미지를 외부 호스팅 후 URL 전달 필요

#### 이미지 생성 방식 비교

| 방식 | Vercel 호환 | 품질 | 비고 |
|------|------------|------|------|
| `@vercel/og` (Satori) | O (Edge Runtime) | 좋음 | JSX → PNG 서버사이드 변환. 추가 의존성 없음 |
| Puppeteer/Playwright | X (50MB 초과) | 최상 | 로컬에서만 가능 |
| html-to-image | 클라이언트만 | 좋음 | 브라우저 DOM 필요 |
| node-canvas | 제한적 | 보통 | 네이티브 바이너리 필요 |

#### 권장 구현 아키텍처

```
[1] 제출 시 → /api/calendar-snapshot (서버)
    ├─ @vercel/og (Satori)로 달력 JSX → PNG 생성
    ├─ Vercel Blob에 업로드 → public URL 획득
    └─ notion.blocks.children.append({ type: 'image', external: { url } })
```

**구현 단계:**
1. `@vercel/og` + `@vercel/blob` 패키지 설치
2. `/api/calendar-snapshot` API 라우트 생성
   - 달력 데이터(dateSchedulesRaw, calYear, calMonth) 받아서 JSX 렌더링
   - Satori로 PNG 생성
   - Vercel Blob에 업로드
3. `/api/schedule-change` 수정
   - Notion 페이지 생성 후 pageId 획득
   - 달력 이미지 URL을 `notion.blocks.children.append`로 페이지에 추가

**예상 작업량:** 2~3시간  
**추가 비용:** Vercel Blob 스토리지 (무료 티어 내 충분)

### 대안: 클라이언트 캡처 방식

브라우저에서 `html-to-image`로 달력 DOM을 캡처 → base64 → API에 전송 → Blob 업로드

- 장점: 화면과 100% 동일한 이미지
- 단점: 클라이언트 의존, 모바일 성능 이슈 가능

### 결론

**`@vercel/og` + Vercel Blob 방식 권장.** Vercel 서버리스에서 동작하고, 추가 인프라 불필요.  
다만 Satori는 Tailwind CSS 클래스를 직접 지원하지 않아, 달력 컴포넌트를 인라인 스타일로 재작성해야 함.

---

## Vercel 환경변수 추가 필요 (배포 시)

| 변수명 | 용도 | 비고 |
|--------|------|------|
| `ADMIN_TOKEN` | 관리자 비밀번호 | 미설정 시 인증 없이 통과 (개발 모드) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob 이미지 업로드 | 달력 이미지 기능 구현 시 필요 |
