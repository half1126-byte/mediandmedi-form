import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.clinicName || !body.doctorName || !body.reason) {
      return NextResponse.json(
        { success: false, error: '필수 항목 누락' },
        { status: 400 }
      );
    }

    // 데모 모드
    const demoPageId = 'change-' + Date.now().toString(36);

    return NextResponse.json({
      success: true,
      pageId: demoPageId,
      demo: true,
    });
  } catch (error) {
    console.error('Change submit error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
