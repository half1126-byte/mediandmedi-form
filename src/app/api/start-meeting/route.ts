import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@notionhq/client';

const MEETING_DB_ID = 'f7b5f3e9-ce21-4259-9d0e-edda716e588a';
const MEETING_DB_FALLBACK_URL = 'https://www.notion.so/f7b5f3e9ce2142599d0eedda716e588a';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const standardChildren: any[] = [
  {
    object: 'block',
    type: 'callout',
    callout: {
      rich_text: [
        {
          type: 'text',
          text: {
            content:
              '🎙 받아쓰기 시작 — 본문 빈 줄 클릭 → "/AI노트" 입력 → 회의 노트 블록의 마이크 아이콘 클릭. 미팅 종료 후 "/AI" → "AI 요약 지침대로 정리" 명령으로 자동 정리.',
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
    heading_3: { rich_text: [{ type: 'text', text: { content: '주요 안건' } }] },
  },
  { object: 'block', type: 'paragraph', paragraph: { rich_text: [] } },
  {
    object: 'block',
    type: 'heading_3',
    heading_3: { rich_text: [{ type: 'text', text: { content: '핵심 결정사항' } }] },
  },
  { object: 'block', type: 'paragraph', paragraph: { rich_text: [] } },
  {
    object: 'block',
    type: 'heading_3',
    heading_3: { rich_text: [{ type: 'text', text: { content: '액션 아이템' } }] },
  },
  { object: 'block', type: 'to_do', to_do: { rich_text: [], checked: false } },
];

// 노션 [미팅] 템플릿의 회의 노트(AI 받아쓰기) 블록. API에서는 meeting_notes type.
// title 등 prop을 보내면 거부되므로 빈 객체로만 생성.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const transcriptionChildren: any[] = [
  { object: 'block', type: 'meeting_notes', meeting_notes: {} },
];

export async function POST(req: NextRequest) {
  const auth = process.env.NOTION_MEETING_API_KEY || process.env.NOTION_API_KEY;
  if (!auth) {
    return NextResponse.json({ success: true, url: MEETING_DB_FALLBACK_URL, demo: true });
  }

  let body: { clinicName?: string; clinicPageId?: string } = {};
  try {
    body = await req.json();
  } catch {
    // body 없어도 진행
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
      properties: any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      children: any[]
    ) =>
      notion.pages.create({
        parent: { database_id: MEETING_DB_ID },
        properties,
        children,
      });

    let page;
    let relationApplied = !!clinicPageId;
    let transcriptionApplied = true;

    // 1차: relation + transcription 모두 포함
    try {
      page = await createPage(propsWithRel, transcriptionChildren);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      const isPermission = /Could not find page/i.test(msg) && clinicPageId;
      const isTranscriptionUnsupported =
        /transcription|meeting_notes|Cannot create|unsupported|validation_error|body failed validation/i.test(msg);

      if (isPermission && isTranscriptionUnsupported) {
        // 둘 다 실패 → 전체 fallback
        relationApplied = false;
        transcriptionApplied = false;
        page = await createPage(baseProps, standardChildren);
      } else if (isPermission) {
        // 거래처 권한만 실패 → relation 빼고 transcription은 유지
        relationApplied = false;
        try {
          page = await createPage(baseProps, transcriptionChildren);
        } catch (err2) {
          const msg2 = err2 instanceof Error ? err2.message : '';
          if (/transcription|meeting_notes|Cannot create|unsupported|validation_error|body failed validation/i.test(msg2)) {
            transcriptionApplied = false;
            page = await createPage(baseProps, standardChildren);
          } else {
            throw err2;
          }
        }
      } else if (isTranscriptionUnsupported) {
        // transcription만 실패 → standard children으로 재시도 (relation 유지)
        transcriptionApplied = false;
        try {
          page = await createPage(propsWithRel, standardChildren);
        } catch (err2) {
          const msg2 = err2 instanceof Error ? err2.message : '';
          if (/Could not find page/i.test(msg2) && clinicPageId) {
            relationApplied = false;
            page = await createPage(baseProps, standardChildren);
          } else {
            throw err2;
          }
        }
      } else {
        throw err;
      }
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
      transcriptionApplied,
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
