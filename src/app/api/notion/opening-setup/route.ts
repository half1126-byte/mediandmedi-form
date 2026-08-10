import { NextRequest, NextResponse } from 'next/server';
import { ensureOpeningSetup } from '@/lib/notion';

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const secret = process.env.NOTION_AUTOMATION_SECRET;
  if (!secret || request.headers.get('x-automation-secret') !== secret) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const pageId = String(body.pageId || body.page_id || '').trim();
    if (!pageId) return NextResponse.json({ success: false, error: 'pageId is required' }, { status: 400 });
    const result = await ensureOpeningSetup(pageId);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

