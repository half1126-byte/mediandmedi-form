import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/admin-auth';

// 폼과 동일한 통합("메디앤메디 미팅") — 진료일정 변경DB 연결
const notionKey = () => process.env.NOTION_MEETING_API_KEY || process.env.NOTION_API_KEY;
const NV = '2022-06-28';

const txt = (v: string) => ({ rich_text: v ? [{ text: { content: v.substring(0, 1900) } }] : [] });

interface MergeBody {
  primaryId: string;
  archiveIds: string[];
  merged: {
    doctorName?: string;
    tagData?: Record<string, string>;
    events?: string;
    doctorTime?: string;
    holidayReason?: string;
    calendarText?: string;
    specialNote?: string;
    extraRequest?: string;
    printSizes?: string[];
  };
}

export async function POST(request: NextRequest) {
  const apiKey = notionKey();
  if (!apiKey) return NextResponse.json({ success: false }, { status: 500 });

  const authError = verifyAdminToken(request);
  if (authError) return authError;

  const body = (await request.json()) as MergeBody;
  if (!body.primaryId || !Array.isArray(body.archiveIds)) {
    return NextResponse.json({ success: false, error: '잘못된 요청' }, { status: 400 });
  }

  const m = body.merged || {};
  const tg = m.tagData || {};
  // 통합 결과를 변경DB 속성으로 매핑 (작업명/대상연도·월/처리상태_폼/제출일/거래처는 건드리지 않음)
  const properties: Record<string, unknown> = {
    '성함': txt(m.doctorName || ''),
    '휴진일': txt(tg['휴진'] || ''),
    '토요일진료': txt(tg['토요일진료'] || ''),
    '일요일진료': txt(tg['일요일진료'] || ''),
    '오전진료': txt(tg['오전진료'] || ''),
    '오후진료': txt(tg['오후진료'] || ''),
    '야간진료_변경': txt(tg['야간진료'] || ''),
    '공휴일진료': txt(tg['공휴일진료'] || ''),
    '이벤트': txt(m.events || ''),
    '진료시간': txt(m.doctorTime || ''),
    '휴진사유': txt(m.holidayReason || ''),
    '달력 표기 필수내용 원문': txt(m.calendarText || ''),
    '특이사항/병원요청': txt(m.specialNote || ''),
    '기타요청': txt(m.extraRequest || ''),
    '출력사이즈': { multi_select: (m.printSizes || []).map((s) => ({ name: s })) },
  };

  // 1) 대표 레코드에 통합 결과 기록
  const patchRes = await fetch(`https://api.notion.com/v1/pages/${body.primaryId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${apiKey}`, 'Notion-Version': NV, 'Content-Type': 'application/json' },
    body: JSON.stringify({ properties }),
  });
  if (!patchRes.ok) {
    const err = await patchRes.text();
    return NextResponse.json({ success: false, error: err }, { status: 500 });
  }

  // 2) 나머지 중복은 보관처리(archive) — 노션 휴지통에서 복구 가능
  const archived: string[] = [];
  for (const id of body.archiveIds) {
    const r = await fetch(`https://api.notion.com/v1/pages/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${apiKey}`, 'Notion-Version': NV, 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived: true }),
    });
    if (r.ok) archived.push(id);
  }

  return NextResponse.json({ success: true, primaryId: body.primaryId, archived });
}
