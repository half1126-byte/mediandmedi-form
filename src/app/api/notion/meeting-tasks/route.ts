import { NextRequest, NextResponse } from 'next/server';
import { ensureMeetingTasks } from '@/lib/meeting-task-notion';

export const maxDuration = 300;

function findPageId(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const compact = value.replace(/-/g, '');
    const match = compact.match(/[0-9a-f]{32}/i);
    if (match) {
      const id = match[0];
      return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
    }
    return undefined;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findPageId(item);
      if (found) return found;
    }
    return undefined;
  }
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    for (const key of ['page_id', 'pageId', 'id', 'url', 'data']) {
      if (key in object) {
        const found = findPageId(object[key]);
        if (found) return found;
      }
    }
    for (const nested of Object.values(object)) {
      const found = findPageId(nested);
      if (found) return found;
    }
  }
  return undefined;
}

export async function POST(request: NextRequest) {
  const secret = (process.env.NOTION_AUTOMATION_SECRET || '').trim();
  if (!secret || request.headers.get('x-automation-secret') !== secret) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const meetingId = findPageId(body);
    if (!meetingId) {
      return NextResponse.json({ success: false, error: '미팅 페이지 ID를 찾을 수 없습니다.' }, { status: 400 });
    }
    const result = await ensureMeetingTasks(meetingId);
    return NextResponse.json({ success: true, meetingId, ...result });
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : '알 수 없는 오류';
    return NextResponse.json({ success: false, error }, { status: 500 });
  }
}
