import { NextResponse } from 'next/server';

const CLIENT_DB_ID = process.env.NOTION_MAIN_DB_ID || '';

interface NotionPage {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  properties: Record<string, any>;
}

interface NotionQueryResponse {
  results: NotionPage[];
  has_more: boolean;
  next_cursor: string | null;
}

export async function GET() {
  // 거래처 DB는 기존 통합(NOTION_API_KEY)에 권한이 있음. 우선 그것 사용.
  const auth = process.env.NOTION_API_KEY || process.env.NOTION_MEETING_API_KEY;
  if (!auth || !CLIENT_DB_ID) {
    return NextResponse.json({
      success: true,
      demo: true,
      clinics: [
        { name: '서울바른치과', pageId: 'demo-1' },
        { name: '강남스마일치과', pageId: 'demo-2' },
        { name: '연세밝은치과', pageId: 'demo-3' },
      ],
    });
  }

  try {
    const clinics: { name: string; pageId: string }[] = [];
    let cursor: string | undefined;

    do {
      const res = await fetch(
        `https://api.notion.com/v1/databases/${CLIENT_DB_ID}/query`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${auth}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            page_size: 100,
            ...(cursor ? { start_cursor: cursor } : {}),
          }),
        }
      );

      if (!res.ok) {
        const text = await res.text();
        return NextResponse.json(
          { success: false, error: `Notion ${res.status}: ${text}`, clinics: [] },
          { status: 500 }
        );
      }

      const data: NotionQueryResponse = await res.json();
      for (const page of data.results) {
        const titleProp = Object.values(page.properties).find(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (p: any) => p?.type === 'title'
        ) as { title?: { plain_text?: string }[] } | undefined;
        const name = titleProp?.title?.[0]?.plain_text?.trim();
        if (name) clinics.push({ name, pageId: page.id });
      }

      cursor = data.has_more ? data.next_cursor || undefined : undefined;
    } while (cursor);

    clinics.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    return NextResponse.json({ success: true, clinics });
  } catch (error) {
    console.error('clinic-list error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown', clinics: [] },
      { status: 500 }
    );
  }
}
