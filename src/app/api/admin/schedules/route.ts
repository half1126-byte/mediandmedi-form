import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/admin-auth';

export async function GET(request: NextRequest) {
  const authError = verifyAdminToken(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month'); // "2026년 5월" 형식

  const apiKey = process.env.NOTION_API_KEY;
  const dbId = process.env.NOTION_SCHEDULE_DB_ID;

  if (!apiKey || !dbId) {
    return NextResponse.json({ success: false, error: 'Not configured' }, { status: 500 });
  }

  try {
    const body: Record<string, unknown> = {
      sorts: [{ property: '제출일', direction: 'descending' }],
      page_size: 100,
    };

    if (month) {
      body.filter = {
        property: '대상월',
        rich_text: { equals: month },
      };
    }

    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ success: false, error: err }, { status: 500 });
    }

    const data = await res.json();

    const records = data.results.map((page: Record<string, unknown>) => {
      const p = page.properties as Record<string, Record<string, unknown>>;
      const getText = (prop: Record<string, unknown> | undefined) => {
        const arr = prop?.rich_text as Array<{ plain_text: string }> | undefined;
        return arr?.[0]?.plain_text || '';
      };
      const getSelect = (prop: Record<string, unknown> | undefined) => {
        const sel = prop?.select as { name: string } | undefined;
        return sel?.name || '';
      };
      const getMultiSelect = (prop: Record<string, unknown> | undefined) => {
        const arr = prop?.multi_select as Array<{ name: string }> | undefined;
        return arr?.map((o) => o.name) || [];
      };
      const getDate = (prop: Record<string, unknown> | undefined) => {
        const d = prop?.date as { start: string } | undefined;
        return d?.start || '';
      };
      const getTitle = (prop: Record<string, unknown> | undefined) => {
        const arr = prop?.title as Array<{ plain_text: string }> | undefined;
        return arr?.[0]?.plain_text || '';
      };

      return {
        id: page.id as string,
        clinicName: getTitle(p['이름'] || p['title']),
        clinicNameSelect: getSelect(p['거래처명']),
        doctorName: getText(p['성함']),
        targetMonth: getText(p['대상월']),
        scheduleData: getText(p['일정데이터']),
        events: getText(p['이벤트']),
        printSizes: getMultiSelect(p['출력사이즈']),
        extraRequest: getText(p['기타요청']),
        status: getSelect(p['처리상태']),
        assignee: getSelect(p['담당자']),
        submittedAt: getDate(p['제출일']),
        tagData: {
          '휴진': getText(p['휴진일']),
          '토요일진료': getText(p['토요일진료']),
          '일요일진료': getText(p['일요일진료']),
          '오전진료': getText(p['오전진료']),
          '오후진료': getText(p['오후진료']),
          '야간진료': getText(p['야간진료']),
          '공휴일진료': getText(p['공휴일진료']),
        },
      };
    });

    return NextResponse.json({ success: true, records });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
