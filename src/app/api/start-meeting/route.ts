import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';

const MEETING_DB_ID = '73219abe-2f01-40d3-9ced-da8afb3e3213';
const MEETING_DB_FALLBACK_URL = 'https://www.notion.so/f7b5f3e9ce2142599d0eedda716e588a';

export async function POST() {
  const auth = process.env.NOTION_MEETING_API_KEY || process.env.NOTION_API_KEY;
  if (!auth) {
    return NextResponse.json({ success: true, url: MEETING_DB_FALLBACK_URL, demo: true });
  }

  try {
    const notion = new Client({ auth });

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const title = `미팅 - ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    const page = await notion.pages.create({
      parent: { database_id: MEETING_DB_ID },
      properties: {
        '미팅 제목': { title: [{ text: { content: title } }] },
        '일자': { date: { start: dateStr } },
      },
    });

    const pageUrl = 'url' in page && typeof page.url === 'string'
      ? page.url
      : `https://www.notion.so/${page.id.replace(/-/g, '')}`;

    return NextResponse.json({ success: true, url: pageUrl, pageId: page.id });
  } catch (error) {
    console.error('start-meeting error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error', fallbackUrl: MEETING_DB_FALLBACK_URL },
      { status: 500 }
    );
  }
}
