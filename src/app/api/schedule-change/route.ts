import { NextRequest, NextResponse } from 'next/server';
import { createScheduleChangeRecord } from '@/lib/notion';

const isDemoMode = !process.env.NOTION_API_KEY || !process.env.NOTION_SCHEDULE_DB_ID;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.clinicName || !body.doctorName) {
      return NextResponse.json(
        { success: false, error: '필수 항목 누락 (치과명, 원장명)' },
        { status: 400 }
      );
    }

    if (isDemoMode) {
      const demoPageId = 'schedule-' + Date.now().toString(36);
      return NextResponse.json({ success: true, pageId: demoPageId, demo: true });
    }

    const pageId = await createScheduleChangeRecord(body);

    return NextResponse.json({ success: true, pageId });
  } catch (error) {
    console.error('Schedule change error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
