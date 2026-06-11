import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/admin-auth';

// 폼과 동일한 통합("메디앤메디 미팅") — 진료일정 변경DB는 이 통합에 연결됨
const notionKey = () => process.env.NOTION_MEETING_API_KEY || process.env.NOTION_API_KEY;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const apiKey = notionKey();
  if (!apiKey) return NextResponse.json({ success: false }, { status: 500 });

  const authError = verifyAdminToken(request);
  if (authError) return authError;

  const { id } = await params;
  const body = await request.json() as Record<string, unknown>;
  const properties: Record<string, unknown> = {};

  // 변경DB의 처리상태 속성은 '처리상태_폼' (옵션: 접수/검토/처리완료)
  if (body.status) properties['처리상태_폼'] = { select: { name: body.status } };

  const res = await fetch(`https://api.notion.com/v1/pages/${id}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ properties }),
  });

  const data = await res.json();
  return NextResponse.json({ success: res.ok, data });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const apiKey = notionKey();
  if (!apiKey) return NextResponse.json({ success: false }, { status: 500 });

  const authError2 = verifyAdminToken(request);
  if (authError2) return authError2;

  const { id } = await params;

  const res = await fetch(`https://api.notion.com/v1/pages/${id}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ archived: true }),
  });

  return NextResponse.json({ success: res.ok });
}
