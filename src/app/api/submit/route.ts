import { webRequiredComplete } from '@/lib/web-required';
import { marketingDirectionComplete, didInfoComplete } from '@/lib/marketing';
import { brandingComplete } from '@/lib/branding';
import { operationsComplete } from '@/lib/operations';
import { setupAccountsComplete } from '@/lib/setup-accounts';
import { doctorProfilesComplete } from '@/lib/doctors';
import { NextRequest, NextResponse } from 'next/server';
import { createMainRecord, ensureOpeningSetup } from '@/lib/notion';

// 거래처 본문 블록과 속성을 함께 저장하므로 기본 함수 타임아웃보다 여유 있게 둔다.
export const maxDuration = 300;

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

    if (typeof step1.phone !== 'string' || !step1.phone.trim()) {
      return NextResponse.json(
        { success: false, error: '대표전화는 필수입니다.' },
        { status: 400 }
      );
    }

    if (typeof step1.address !== 'string' || !step1.address.trim()) {
      return NextResponse.json(
        { success: false, error: '상세 주소는 필수입니다.' },
        { status: 400 }
      );
    }

    if (typeof body.step4?.education !== 'string' || !body.step4.education.trim() ||
        typeof body.step4?.career !== 'string' || !body.step4.career.trim()) {
      return NextResponse.json(
        { success: false, error: '학력과 경력은 필수입니다.' },
        { status: 400 }
      );
    }

    if (step1.doctors !== undefined && (!Array.isArray(step1.doctors) ||
        !doctorProfilesComplete(step1.doctors, step1.doctorCount, body.step4 || {}, step1.doctorName))) {
      return NextResponse.json({ success: false, error: '모든 의료진의 성함·학력·경력을 입력해주세요.' }, { status: 400 });
    }

    if ((body.scope?.marketing || body.scope?.viral) && !marketingDirectionComplete(body.step5)) {
      return NextResponse.json({ success: false, error: '마케팅 목표와 원하는 채널을 선택하고 기타 내용을 입력해 주세요.' }, { status: 400 });
    }

    if ((body.scope?.marketing || body.scope?.viral) && !didInfoComplete(body.step5)) {
      return NextResponse.json({ success: false, error: '대기실 모니터(DID) 정보를 입력해 주세요. 미설치인 경우 미설치라고 적어 주세요.' }, { status: 400 });
    }

    if ((body.scope?.marketing || body.scope?.viral) && !setupAccountsComplete(body.accounts)) {
      return NextResponse.json({ success: false, error: '네이버·구글·카카오·대한치과협회 의료광고심의 계정 상태와 필수 정보를 확인해주세요.' }, { status: 400 });
    }

    if (!operationsComplete(body.step2, body.step3)) {
      return NextResponse.json({ success: false, error: '진료시간·보유 장비·시설·주차·기공소 보유 여부를 확인해주세요.' }, { status: 400 });
    }

    if (!brandingComplete(body.step4)) {
      return NextResponse.json({ success: false, error: '병원 이미지·선호 색상은 필수입니다.' }, { status: 400 });
    }

    if (body.scope?.web && !webRequiredComplete(body.stepWeb)) {
      return NextResponse.json({ success: false, error: '일정·관리 방식·피드백 전달 방식·도메인·SSL의 필수 항목을 확인해 주세요.' }, { status: 400 });
    }

    if (!(process.env.NOTION_MEETING_API_KEY?.trim() || process.env.NOTION_API_KEY?.trim()) || !process.env.NOTION_MAIN_DB_ID?.trim()) {
      return NextResponse.json({ success: false, error: '노션 연결 설정이 없어 저장하지 못했습니다. 입력 내용은 유지됩니다. 담당자에게 연결 설정을 요청해 주세요.' }, { status: 503 });
    }

    // 실제 Notion 연동
    const pageId = await createMainRecord(body);

    // 업무 생성은 거래처DB의 `신규 업무 생성` 트리거를 단일 진입점으로 사용한다.
    // 구형 팀업무DB/개원세팅DB에 직접 쓰면 현재 (신)업무DB 자동화와 중복되므로 생성하지 않는다.
    let openingSetup;
    try {
      openingSetup = await ensureOpeningSetup(pageId);
    } catch (error) {
      console.error('Opening setup failed after client was saved:', error);
      return NextResponse.json({
        success: true, pageId, pin, taskResults: [], openingResults: [],
        warning: '거래처 정보는 노션에 저장되었습니다. 다만 직원·업무 DB 설정 문제로 개원 업무 자동 생성이 완료되지 않았습니다. 담당자 확인이 필요합니다.',
      });
    }

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
