import { describe, it, expect, vi, beforeEach } from 'vitest';

// Notion API mock — 실제 노션 쓰기 0
vi.mock('@/lib/notion', () => ({
  createOpeningSetupTask: vi.fn().mockResolvedValue({ success: true }),
  hasOpeningSetupTasks: vi.fn().mockResolvedValue(false),
}));

import { generateOpeningSetup, selectOpeningTasks } from '@/lib/opening-setup';
import { createOpeningSetupTask, hasOpeningSetupTasks } from '@/lib/notion';
import { OPENING_SETUP_TASKS } from '@/data/opening-setup';

const ALL_TEAMS = ['마케팅팀', '바이럴팀', '디자인팀', '웹팀'];

beforeEach(() => {
  vi.mocked(hasOpeningSetupTasks).mockReset().mockResolvedValue(false);
  vi.mocked(createOpeningSetupTask).mockReset().mockResolvedValue({ success: true });
});

describe('generateOpeningSetup', () => {
  it('전체 계약 → 42건 생성 + 페이로드 검증', async () => {
    const results = await generateOpeningSetup('clinic-1', ALL_TEAMS);

    expect(results).toHaveLength(42);
    expect(vi.mocked(createOpeningSetupTask)).toHaveBeenCalledTimes(42);

    const first = vi.mocked(createOpeningSetupTask).mock.calls[0][0];
    expect(first.국면).toBe('① 킥오프·준비');
    expect(first.담당팀).toBe('PM');
    expect(first.dOffset).toBe(-44);
    expect(first.clinicPageId).toBe('clinic-1');
  });

  it('마케팅만 계약 → PM·마케팅팀 19건만 (웹/디자인/바이럴/영상 0)', async () => {
    const results = await generateOpeningSetup('clinic-1', ['마케팅팀']);

    expect(results).toHaveLength(19);
    expect(new Set(results.map((r) => r.담당팀))).toEqual(new Set(['PM', '마케팅팀']));
    expect(
      results.some((r) => ['웹팀', '디자인팀', '바이럴팀', '영상팀'].includes(r.담당팀))
    ).toBe(false);
  });

  it('웹팀 계약 추가 → 웹팀 업무 포함', async () => {
    const results = await generateOpeningSetup('clinic-1', ['마케팅팀', '웹팀']);
    expect(results.some((r) => r.담당팀 === '웹팀')).toBe(true);
    expect(results.some((r) => r.담당팀 === '디자인팀')).toBe(false);
  });

  it('멱등성: 이미 생성됨 → 0건 생성, skipped 결과', async () => {
    vi.mocked(hasOpeningSetupTasks).mockResolvedValueOnce(true);

    const results = await generateOpeningSetup('clinic-1', ALL_TEAMS);

    expect(results).toHaveLength(1);
    expect(results[0].skipped).toBe(true);
    expect(vi.mocked(createOpeningSetupTask)).not.toHaveBeenCalled();
  });

  it('부분 실패 처리 — 루프 지속', async () => {
    vi.mocked(createOpeningSetupTask)
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValue({ success: false, error: 'API 에러' });

    const results = await generateOpeningSetup('clinic-1', ['마케팅팀']);

    expect(results).toHaveLength(19);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(false);
    expect(results[1].error).toBe('API 에러');
  });
});

describe('selectOpeningTasks 범위 게이팅', () => {
  it('옵션(No.28 영상)은 디자인팀 계약 시에만', () => {
    expect(selectOpeningTasks(['마케팅팀']).some((t) => t.no === 28)).toBe(false);
    expect(selectOpeningTasks(['디자인팀']).some((t) => t.no === 28)).toBe(true);
  });

  it('영상팀 업무는 디자인 계약 버킷으로 게이팅', () => {
    expect(selectOpeningTasks(['디자인팀']).some((t) => t.담당팀 === '영상팀')).toBe(true);
    expect(selectOpeningTasks(['웹팀']).some((t) => t.담당팀 === '영상팀')).toBe(false);
  });
});

describe('OPENING_SETUP_TASKS 데이터 무결성', () => {
  const PHASES = new Set([
    '① 킥오프·준비', '② 기반 제작', '③ 인증·심의', '③-B 콘텐츠·바이럴',
    '④ 예약·연결·인쇄', '⑤ 개원 점검', '⑥ 운영 전환',
  ]);
  const TEAMS = new Set(['마케팅팀', '디자인팀', '웹팀', 'PM', '바이럴팀', '영상팀']);

  it('42건, 국면·담당팀 유효, dOffset 숫자', () => {
    expect(OPENING_SETUP_TASKS).toHaveLength(42);
    for (const t of OPENING_SETUP_TASKS) {
      expect(PHASES.has(t.국면)).toBe(true);
      expect(TEAMS.has(t.담당팀)).toBe(true);
      expect(typeof t.dOffset).toBe('number');
      expect(t.업무명.length).toBeGreaterThan(0);
    }
  });

  it('No.28만 optional', () => {
    expect(OPENING_SETUP_TASKS.filter((t) => t.optional).map((t) => t.no)).toEqual([28]);
  });

  it('no 1..42 유니크', () => {
    expect(new Set(OPENING_SETUP_TASKS.map((t) => t.no)).size).toBe(42);
  });

  it('직접 19 / 핸드오프 23', () => {
    expect(OPENING_SETUP_TASKS.filter((t) => !t.handoff)).toHaveLength(19);
    expect(OPENING_SETUP_TASKS.filter((t) => t.handoff)).toHaveLength(23);
  });
});
