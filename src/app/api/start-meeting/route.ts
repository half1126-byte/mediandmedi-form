import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@notionhq/client';

const MEETING_DB_ID = 'f7b5f3e9-ce21-4259-9d0e-edda716e588a';
const MEETING_DB_FALLBACK_URL = 'https://www.notion.so/f7b5f3e9ce2142599d0eedda716e588a';

export async function POST(req: NextRequest) {
  const auth = process.env.NOTION_MEETING_API_KEY || process.env.NOTION_API_KEY;
  if (!auth) {
    return NextResponse.json({ success: true, url: MEETING_DB_FALLBACK_URL, demo: true });
  }

  let body: { clinicName?: string; clinicPageId?: string } = {};
  try {
    body = await req.json();
  } catch {
    // body 없어도 진행 (제목만 시간으로)
  }

  const clinicName = (body.clinicName || '').trim();
  const clinicPageId = (body.clinicPageId || '').trim();

  try {
    const notion = new Client({ auth });

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const title = clinicName
      ? `${clinicName} - ${dateStr} ${timeStr}`
      : `미팅 - ${dateStr} ${timeStr}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const baseProps: any = {
      '미팅 제목': { title: [{ text: { content: title } }] },
      '일자': { date: { start: dateStr } },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const propsWithRel: any = clinicPageId
      ? { ...baseProps, '거래처': { relation: [{ id: clinicPageId }] } }
      : baseProps;

    const createPage = async (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      properties: any
    ) =>
      notion.pages.create({
        parent: { database_id: MEETING_DB_ID },
        properties,
        children: [
        {
          object: 'block',
          type: 'callout',
          callout: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content:
                    '🎙 AI 받아쓰기 시작하기: 본문에서 "/AI노트" 입력 → 회의 노트 블록이 추가되면 마이크 아이콘 클릭. 미팅 후 자동 요약은 "/AI" → "AI 요약 지침"으로 정리.',
                },
              },
            ],
            icon: { type: 'emoji', emoji: '🎙' },
            color: 'gray_background',
          },
        },
        { object: 'block', type: 'paragraph', paragraph: { rich_text: [] } },
        {
          object: 'block',
          type: 'heading_3',
          heading_3: {
            rich_text: [{ type: 'text', text: { content: '주요 안건' } }],
          },
        },
        { object: 'block', type: 'paragraph', paragraph: { rich_text: [] } },
        {
          object: 'block',
          type: 'heading_3',
          heading_3: {
            rich_text: [{ type: 'text', text: { content: '핵심 결정사항' } }],
          },
        },
        { object: 'block', type: 'paragraph', paragraph: { rich_text: [] } },
        {
          object: 'block',
          type: 'heading_3',
          heading_3: {
            rich_text: [{ type: 'text', text: { content: '액션 아이템' } }],
          },
        },
        {
          object: 'block',
          type: 'to_do',
          to_do: { rich_text: [], checked: false },
        },
      ],
      });

    let page;
    let relationApplied = !!clinicPageId;
    try {
      page = await createPage(propsWithRel);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      const isPermission = /Could not find page|integration/i.test(msg) && clinicPageId;
      if (!isPermission) throw err;
      // 거래처 페이지에 통합 권한이 없으면 relation 빼고 재시도
      relationApplied = false;
      page = await createPage(baseProps);
    }

    const pageUrl =
      'url' in page && typeof page.url === 'string'
        ? page.url
        : `https://www.notion.so/${page.id.replace(/-/g, '')}`;

    return NextResponse.json({
      success: true,
      url: pageUrl,
      pageId: page.id,
      title,
      relationApplied,
    });
  } catch (error) {
    console.error('start-meeting error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        fallbackUrl: MEETING_DB_FALLBACK_URL,
      },
      { status: 500 }
    );
  }
}
