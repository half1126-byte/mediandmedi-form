import { NextRequest, NextResponse } from 'next/server';
import { createMainRecord, ensureOpeningSetup } from '@/lib/notion';

// 거래처 본문 블록과 속성을 함께 저장하므로 기본 함수 타임아웃보다 여유 있게 둔다.
export const maxDuration = 300;

// lib/notion.ts와 동일 우선순위: NOTION_MEETING_API_KEY가 신 워크스페이스 키
const isDemoMode =
  (!process.env.NOTION_MEETING_API_KEY && !process.env.NOTION_API_KEY) ||
  !process.env.NOTION_MAIN_DB_ID;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pin, step1 } = body;

    // 서버측 검증: 치과명 없으면 거부 (빈 거래처 페이지 생성 방지 — 폼 UI 우회/직접 호출 방어)
    if (!step1?.clinicName || !String(step1.clinicName).trim()) {
      return NextResponse.json(
        { success: false, error: '치과명(clinicName)은 필수입니다.' },
        { status: 400 }
      );
    }

    // 데모 모드: 환경변수 없으면 자동 전환
    if (isDemoMode) {
      const demoPageId = 'demo-' + Date.now().toString(36);
      return NextResponse.json({
        success: true,
        pageId: demoPageId,
        pin,
        taskResults: [],
        openingResults: [],
        demo: true,
      });
    }

    // 실제 Notion 연동
    const pageId = await createMainRecord(body);

    // 업무 생성은 거래처DB의 `신규 업무 생성` 트리거를 단일 진입점으로 사용한다.
    // 구형 팀업무DB/개원세팅DB에 직접 쓰면 현재 (신)업무DB 자동화와 중복되므로 생성하지 않는다.
    const openingSetup = await ensureOpeningSetup(pageId);

    return NextResponse.json({
      success: true,
      pageId,
      pin,
      taskResults: [],
      openingResults: [openingSetup],
    });
  } catch (error) {
    console.error('Submit error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

