import { OPENING_SETUP_TASKS, type OpeningSetupTask } from '@/data/opening-setup';
import { createOpeningSetupTask, hasOpeningSetupTasks } from './notion';

export interface OpeningSetupResult {
  no: number;
  업무명: string;
  담당팀: string;
  success: boolean;
  skipped?: boolean;
  error?: string;
}

// 담당팀 → 거래처DB '계약 서비스' 옵션 매핑.
// null = 항상 생성(마케팅팀 = 관제). 영상팀은 디자인 계약 버킷에 포함
// (폼이 scope.video를 디자인팀으로 접고, design-video/youtube 서비스도 팀=디자인팀이므로).
const TEAM_TO_CONTRACT: Record<string, string | null> = {
  마케팅팀: null,
  디자인팀: '디자인팀',
  영상팀: '디자인팀',
  웹팀: '웹팀',
  바이럴팀: '바이럴팀',
};

/**
 * 계약 서비스(팀)에 따라 생성할 개원세팅 업무 선별.
 * 마케팅팀은 항상, 디자인·웹·바이럴·영상은 해당 팀이 계약에 있을 때만.
 * 옵션 업무(현재 No.28 영상)는 디자인팀 계약 시에만.
 */
export function selectOpeningTasks(contractTeams: string[]): OpeningSetupTask[] {
  return OPENING_SETUP_TASKS.filter((t) => {
    if (t.optional && !contractTeams.includes('디자인팀')) return false;
    const contract = TEAM_TO_CONTRACT[t.담당팀];
    if (contract === null) return true;
    return contractTeams.includes(contract);
  });
}

/**
 * 거래처(clinicPageId) 생성 직후 호출 — 🏥개원세팅DB에 개원세팅 업무를 일괄 생성.
 * - 멱등성: 이미 해당 거래처의 업무가 있으면 생성하지 않음(재제출 중복 방지).
 * - 범위: 계약 서비스(팀)에 따라 게이팅.
 * - 부분 실패 허용: 개별 실패는 결과에 담고 루프는 계속.
 */
export async function generateOpeningSetup(
  clinicPageId: string,
  contractTeams: string[],
  openDate?: string
): Promise<OpeningSetupResult[]> {
  if (await hasOpeningSetupTasks(clinicPageId)) {
    return [{ no: 0, 업무명: '(이미 생성됨 — 건너뜀)', 담당팀: '-', success: true, skipped: true }];
  }

  const results: OpeningSetupResult[] = [];
  for (const t of selectOpeningTasks(contractTeams)) {
    const r = await createOpeningSetupTask({
      업무명: t.업무명,
      단계: t.단계,
      담당팀: t.담당팀,
      dOffset: t.dOffset,
      clinicPageId,
      openDate,
      메모: t.handoff ? '핸드오프: (신)업무DB에 제작 의뢰 후 실행업무 연결' : undefined,
    });
    results.push({ no: t.no, 업무명: t.업무명, 담당팀: t.담당팀, success: r.success, error: r.error });
  }
  return results;
}
