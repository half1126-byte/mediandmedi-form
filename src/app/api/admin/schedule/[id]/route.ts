import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/admin-auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) return NextResponse.json({ success: false }, { status: 500 });

  const authError = verifyAdminToken(request);
  if (authError) return authError;

  const { id } = await params;
  const body = await request.json() as Record<string, unknown>;
  const properties: Record<string, unknown> = {};

  if (body.status) properties['처리상태'] = { select: { name: body.status } };
  if (body.assignee !== undefined) {
    properties['담당자'] = body.assignee
      ? { select: { name: body.assignee } }
      : { select: null };
  }
  if (body.memo !== undefined) {
    properties['관리자메모'] = { rich_text: [{ text: { content: body.memo } }] };
  }

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
  const apiKey = process.env.NOTION_API_KEY;
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
