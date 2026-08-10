
import { NextRequest, NextResponse } from 'next/server';
import { syncOpeningTaskCompletion } from '@/lib/notion';

export const maxDuration = 60;

function authorized(request: NextRequest): boolean {
  const secret = process.env.NOTION_AUTOMATION_SECRET;
  return Boolean(secret && request.headers.get('x-automation-secret') === secret);
}

function taskIdFrom(body: Record<string, unknown>): string {
  const direct = body.taskId || body.task_id || body['업무 키'];
  if (typeof direct === 'string') return direct.trim();
  const properties = body.properties as Record<string, unknown> | undefined;
  const value = properties?.['업무 키'];
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object') {
    const property = value as Record<string, unknown>;
    const text = property.value || property.text || property.plain_text;
    if (typeof text === 'string') return text.trim();
  }
  return '';
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

