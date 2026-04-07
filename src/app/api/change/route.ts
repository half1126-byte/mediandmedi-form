import { NextRequest, NextResponse } from 'next/server';
import { createChangeRecord } from '@/lib/notion';

const isDemoMode = !process.env.NOTION_API_KEY || !process.env.NOTION_CHANGE_DB_ID;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.clinicName || !body.doctorName || !body.reason) {
      return NextResponse.json(
        { success: false, error: '필수 항목 누락' },
        { status: 400 }
      );
    }

    // 데모 모드: 환경변수 없으면 자동 전환
    if (isDemoMode) {
      const demoPageId = 'change-' + Date.now().toString(36);
      return NextResponse.json({
        success: true,
        pageId: demoPageId,
        demo: true,
      });
    }

    // 실제 Notion 연동
    const pageId = await createChangeRecord(body);

    return NextResponse.json({
      success: true,
      pageId,
    });
  } catch (error) {
    console.error('Change submit error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
