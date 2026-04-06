import { NextRequest, NextResponse } from 'next/server';
import { createMainRecord } from '@/lib/notion';
import { generateTeamTasks } from '@/lib/team-tasks';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pin, ...formData } = body;

    // 메인 DB 저장
    const pageId = await createMainRecord(formData);

    // 팀별 업무 자동 생성
    const services = formData.step6?.services || [];
    let taskResults: { team: string; success: boolean; error?: string }[] = [];

    if (services.length > 0) {
      const clinicName = formData.step1?.clinicName || '미입력';
      taskResults = await generateTeamTasks(clinicName, services, pageId);
    }

    // PIN 저장 (요약 페이지 접근용, 서버 측에서는 메모리에만)
    // 실제 프로덕션에서는 Notion 속성이나 별도 저장소 사용
    // MVP에서는 클라이언트 localStorage로 PIN 관리

    const hasPartialFailure = taskResults.some((r) => !r.success);

    return NextResponse.json({
      success: true,
      pageId,
      pin,
      taskResults,
      warning: hasPartialFailure
        ? '일부 팀별 업무가 생성되지 않았습니다. 관리자에게 문의해주세요.'
        : undefined,
    });
  } catch (error) {
    console.error('Submit error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
