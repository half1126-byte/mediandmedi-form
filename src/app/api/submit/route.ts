import { NextRequest, NextResponse } from 'next/server';
import { createMainRecord } from '@/lib/notion';
import { generateTeamTasks } from '@/lib/team-tasks';

// lib/notion.ts와 동일 우선순위: NOTION_MEETING_API_KEY가 신 워크스페이스 키
const isDemoMode =
  (!process.env.NOTION_MEETING_API_KEY && !process.env.NOTION_API_KEY) ||
  !process.env.NOTION_MAIN_DB_ID;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pin, step1, step6 } = body;

    // 데모 모드: 환경변수 없으면 자동 전환
    if (isDemoMode) {
      const demoPageId = 'demo-' + Date.now().toString(36);
      return NextResponse.json({
        success: true,
        pageId: demoPageId,
        pin,
        taskResults: [],
        demo: true,
      });
    }

    // 실제 Notion 연동
    const pageId = await createMainRecord(body);

    // 팀별 업무 자동 생성 (부분 실패 허용)
    let taskResults: { team: string; taskName: string; success: boolean; error?: string }[] = [];
    const clinicName = step1?.clinicName || '';
    const services = step6?.services || [];

    if (services.length > 0 && clinicName) {
      taskResults = await generateTeamTasks(clinicName, services, pageId);
    }

    return NextResponse.json({
      success: true,
      pageId,
      pin,
      taskResults,
    });
  } catch (error) {
    console.error('Submit error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
