import { NextRequest, NextResponse } from 'next/server';
import { createMainRecord, deriveContractTeams } from '@/lib/notion';
import { generateTeamTasks } from '@/lib/team-tasks';
import { generateOpeningSetup } from '@/lib/opening-setup';

// 개원세팅 42건을 순차 생성(노션 rate-limit 회피 350ms 간격, 최대 ~30s)하므로
// 기본 함수 타임아웃을 넘지 않도록 상향 (upload 라우트와 동일 기조).
export const maxDuration = 60;

// lib/notion.ts와 동일 우선순위: NOTION_MEETING_API_KEY가 신 워크스페이스 키
const isDemoMode =
  (!process.env.NOTION_MEETING_API_KEY && !process.env.NOTION_API_KEY) ||
  !process.env.NOTION_MAIN_DB_ID;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pin, step1, step6 } = body;

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

    // 팀별 업무 자동 생성 (부분 실패 허용)
    let taskResults: { team: string; taskName: string; success: boolean; error?: string }[] = [];
    const clinicName = step1?.clinicName || '';
    const services = step6?.services || [];

    if (services.length > 0 && clinicName) {
      taskResults = await generateTeamTasks(clinicName, services, pageId);
    }

    // 신규개원 세팅: 초기개원 패키지 체크 시에만 🏥개원세팅DB에 개원세팅 업무 자동 생성
    // (멱등성으로 재제출 중복 방지, 계약 서비스별 범위 게이팅, 부분 실패 허용)
    let openingResults: Awaited<ReturnType<typeof generateOpeningSetup>> = [];
    if (step6?.isStarterPackage) {
      try {
        openingResults = await generateOpeningSetup(pageId, deriveContractTeams(body));
      } catch (e) {
        // 거래처·팀업무는 이미 생성됨 → 개원세팅 실패해도 200 유지
        console.error('Opening setup generation error:', e);
      }
    }

    return NextResponse.json({
      success: true,
      pageId,
      pin,
      taskResults,
      openingResults,
    });
  } catch (error) {
    console.error('Submit error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
