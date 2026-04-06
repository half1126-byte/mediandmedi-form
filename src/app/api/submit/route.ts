import { NextRequest, NextResponse } from 'next/server';

// TODO: Notion 연동 시 아래 주석 해제
// import { createMainRecord } from '@/lib/notion';
// import { generateTeamTasks } from '@/lib/team-tasks';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pin } = body;

    // 데모 모드: Notion 대신 메모리에서 처리
    const demoPageId = 'demo-' + Date.now().toString(36);

    // TODO: Notion 연동 시 아래로 교체
    // const pageId = await createMainRecord(formData);
    // const taskResults = await generateTeamTasks(clinicName, services, pageId);

    return NextResponse.json({
      success: true,
      pageId: demoPageId,
      pin,
      taskResults: [],
      demo: true,
    });
  } catch (error) {
    console.error('Submit error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
