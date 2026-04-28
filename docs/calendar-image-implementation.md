# 달력 이미지 노션 저장 — 구현 방법

작성일: 2026-04-09

---

## 목표

진료일정 제출 시 달력 상태를 PNG 이미지로 캡처하여 Notion 페이지 본문에 첨부.
디자인팀이 Notion에서 달력 이미지를 바로 확인하고 작업에 활용할 수 있도록 함.

---

## 아키텍처

```
사용자 제출
    ↓
/api/schedule-change (POST)
    ├─ 1) Notion 페이지 생성 (기존 로직) → pageId 획득
    ├─ 2) /api/calendar-image 내부 호출
    │     ├─ Satori(@vercel/og)로 달력 JSX → PNG 생성
    │     └─ Vercel Blob에 업로드 → publicUrl 획득
    └─ 3) notion.blocks.children.append(pageId, 이미지 블록)
```

---

## 구현 단계

### Step 1: 패키지 설치

```bash
npm install @vercel/og @vercel/blob
```

- `@vercel/og`: Satori 기반 JSX → PNG 변환 (Edge Runtime 호환)
- `@vercel/blob`: Vercel 호스팅 파일 스토리지 (public URL 제공)

### Step 2: 달력 이미지 생성 API

**파일:** `src/app/api/calendar-image/route.ts`

```typescript
import { ImageResponse } from '@vercel/og';
import { put } from '@vercel/blob';

export const runtime = 'edge';

export async function POST(request: Request) {
  const { calYear, calMonth, dateSchedulesRaw } = await request.json();

  // 달력 JSX를 인라인 스타일로 구성 (Satori는 Tailwind 미지원)
  const image = new ImageResponse(
    <CalendarImage
      year={calYear}
      month={calMonth}
      schedules={dateSchedulesRaw}
    />,
    { width: 800, height: 600 }
  );

  // PNG 버퍼 추출
  const buffer = await image.arrayBuffer();

  // Vercel Blob에 업로드
  const blob = await put(
    `schedules/${calYear}-${calMonth}-${Date.now()}.png`,
    buffer,
    { access: 'public', contentType: 'image/png' }
  );

  return Response.json({ url: blob.url });
}
```

### Step 3: 달력 렌더링 컴포넌트 (Satori용)

**파일:** `src/lib/calendar-image.tsx`

Satori는 Tailwind CSS를 지원하지 않으므로 **인라인 스타일**로 작성해야 함.

```tsx
// 주의: Satori 지원 CSS만 사용 (flexbox, 기본 색상, 폰트 크기 등)
// border-radius, box-shadow, grid는 제한적 지원

function CalendarImage({ year, month, schedules }) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay();

  const TAG_COLORS = {
    '휴진': '#DC2626',
    '토요일진료': '#2563EB',
    '일요일진료': '#7C3AED',
    '오전진료': '#059669',
    '오후진료': '#D97706',
    '야간진료': '#1E3A5F',
    '공휴일진료': '#BE185D',
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      width: '100%', height: '100%',
      backgroundColor: '#1a1a2e', color: 'white',
      fontFamily: 'sans-serif', padding: '20px',
    }}>
      {/* 헤더 */}
      <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>
        {year}년 {month}월 진료일정
      </div>

      {/* 요일 헤더 */}
      <div style={{ display: 'flex', marginBottom: '4px' }}>
        {['일','월','화','수','목','금','토'].map((d, i) => (
          <div key={d} style={{
            flex: 1, textAlign: 'center', fontSize: '12px',
            color: i === 0 ? '#DC2626' : i === 6 ? '#2563EB' : '#9CA3AF',
          }}>{d}</div>
        ))}
      </div>

      {/* 날짜 그리드 (flexbox 기반, grid 미지원) */}
      {/* ... 각 주를 flex row로, 각 날짜를 flex item으로 렌더링 */}
      {/* 태그가 있는 날짜: 배경색 + 태그명 텍스트 표시 */}
    </div>
  );
}
```

### Step 4: Notion에 이미지 블록 추가

**파일:** `src/lib/notion.ts`에 헬퍼 추가

```typescript
export async function appendImageToPage(pageId: string, imageUrl: string) {
  await withRetry(() =>
    notion.blocks.children.append({
      block_id: pageId,
      children: [{
        type: 'image',
        image: {
          type: 'external',
          external: { url: imageUrl },
        },
      }],
    })
  );
}
```

### Step 5: schedule-change API 수정

**파일:** `src/app/api/schedule-change/route.ts`

```typescript
// 기존: Notion 페이지 생성
const pageId = await createScheduleChangeRecord(body);

// 추가: 달력 이미지 생성 + Notion 첨부
try {
  const imgRes = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/calendar-image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      calYear: body.calYear,
      calMonth: body.calMonth,
      dateSchedulesRaw: body.dateSchedulesRaw,
    }),
  });
  const { url } = await imgRes.json();
  if (url) await appendImageToPage(pageId, url);
} catch (e) {
  console.error('달력 이미지 첨부 실패:', e);
  // 이미지 실패해도 제출 자체는 성공 처리
}
```

---

## Vercel 환경변수 (필수)

| 변수명 | 용도 | 설정 위치 |
|--------|------|-----------|
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob 업로드 인증 | Vercel Dashboard → Settings → Environment Variables |

Vercel 프로젝트에서 Blob Store를 먼저 연결해야 함:
1. Vercel Dashboard → Storage → Create → Blob
2. 프로젝트에 연결 → 자동으로 `BLOB_READ_WRITE_TOKEN` 환경변수 생성

---

## Satori 제약사항

| 항목 | 지원 여부 | 비고 |
|------|----------|------|
| Tailwind CSS | X | 인라인 스타일만 가능 |
| CSS Grid | X | Flexbox만 사용 |
| border-radius | O | 부분 지원 |
| 한글 폰트 | 별도 설정 필요 | Google Fonts Noto Sans KR 사용 권장 |
| box-shadow | X | 미지원 |
| position: absolute | O | 지원 |
| 이미지 태그 | O | 외부 URL 또는 base64 |

### 한글 폰트 설정

```typescript
const fontData = await fetch(
  'https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-kr@latest/korean-400-normal.woff'
).then(res => res.arrayBuffer());

new ImageResponse(jsx, {
  width: 800, height: 600,
  fonts: [{ name: 'Noto Sans KR', data: fontData, style: 'normal' }],
});
```

---

## 대안: 클라이언트 캡처 방식

서버사이드 대신 클라이언트에서 캡처하는 방식:

```bash
npm install html-to-image
```

```typescript
import { toPng } from 'html-to-image';

// 제출 시
const calendarEl = document.getElementById('calendar');
const dataUrl = await toPng(calendarEl);
// dataUrl을 API에 전송 → Blob 업로드 → Notion 첨부
```

| 비교 | 서버사이드 (Satori) | 클라이언트 (html-to-image) |
|------|--------------------|-----------------------|
| 화면 동일성 | 별도 JSX 필요 (차이 가능) | 100% 동일 |
| 성능 | 서버에서 처리 | 클라이언트 부담 |
| 모바일 | 문제 없음 | 저사양 기기 느릴 수 있음 |
| 유지보수 | 달력 UI 변경 시 이미지 JSX도 수정 필요 | 자동 반영 |
| Vercel 호환 | Edge Runtime 필요 | 제한 없음 |

**권장: 클라이언트 캡처가 더 실용적.** 화면과 100% 동일하고 별도 JSX 유지보수 불필요.

---

## 추천 구현 순서

1. `html-to-image` 설치 (클라이언트 캡처 방식)
2. 달력 DOM에 `id="calendar"` 추가
3. 제출 시 `toPng()` → base64 추출
4. API에 base64 전송 → Vercel Blob 업로드 → URL 획득
5. `notion.blocks.children.append`로 이미지 블록 추가

예상 작업: 2~3시간
