
import { NextRequest, NextResponse } from 'next/server';
import { ensureOpeningSetup } from '@/lib/notion';

export const maxDuration = 300;

function pageIdFrom(body: Record<string, unknown>): string {
  const direct = body.pageId || body.page_id || body['자동화 키'];
  if (typeof direct === 'string') return direct.trim();
  const properties = body.properties as Record<string, unknown> | undefined;
  const value = properties?.['자동화 키'];
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object') {
    const property = value as Record<string, unknown>;
    const text = property.value || property.text || property.plain_text;
    if (typeof text === 'string') return text.trim();
  }
  return '';
}

export async function POST(request: NextRequest) {
  const secret = process.env.NOTION_AUTOMATION_SECRET;
  if (!secret || request.headers.get('x-automation-secret') !== secret) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json() as Record<string, unknown>;
    const pageId = pageIdFrom(body);
    if (!pageId) return NextResponse.json({ success: false, error: 'pageId is required' }, { status: 400 });
    const result = await ensureOpeningSetup(pageId);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

