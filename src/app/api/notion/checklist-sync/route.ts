import { NextRequest, NextResponse } from 'next/server';
import { syncOpeningTaskCompletion } from '@/lib/notion';

export const maxDuration = 60;

function authorized(request: NextRequest): boolean {
  const secret = process.env.NOTION_AUTOMATION_SECRET;
  return Boolean(secret && request.headers.get('x-automation-secret') === secret);
}

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

function taskIdFrom(body: Record<string, unknown>): string {
  return findNamedValue(body, new Set(['taskId', 'task_id', '업무 키']));
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json() as Record<string, unknown>;
    const taskId = taskIdFrom(body);
    if (!taskId) return NextResponse.json({ success: false, error: '업무 키 is required' }, { status: 400 });
    const result = await syncOpeningTaskCompletion(taskId);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
