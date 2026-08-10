import { NextRequest, NextResponse } from 'next/server';
import { ensureOpeningSetup } from '@/lib/notion';

export const maxDuration = 300;

function stringValue(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (!value || typeof value !== 'object') return '';
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = stringValue(item);
      if (found) return found;
    }
    return '';
  }
  const record = value as Record<string, unknown>;
  for (const key of ['string', 'value', 'text', 'plain_text', 'formula', 'rich_text', 'title']) {
    const found = stringValue(record[key]);
    if (found) return found;
  }
  return '';
}

function findNamedValue(value: unknown, names: Set<string>): string {
  if (!value || typeof value !== 'object') return '';
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findNamedValue(item, names);
      if (found) return found;
    }
    return '';
  }
  const record = value as Record<string, unknown>;
  for (const [key, child] of Object.entries(record)) {
    if (names.has(key)) {
      const found = stringValue(child);
      if (found) return found;
    }
  }
  for (const child of Object.values(record)) {
    const found = findNamedValue(child, names);
    if (found) return found;
  }
  return '';
}

function pageIdFrom(body: Record<string, unknown>): string {
  const data = body.data as Record<string, unknown> | undefined;
  const eventPageId = stringValue(data?.id);
  if (eventPageId) return eventPageId;
  return findNamedValue(body, new Set(['pageId', 'page_id', '자동화 키']));
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
