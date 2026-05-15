import { describe, it, expect, vi } from 'vitest';

// Notion API mock
vi.mock('@/lib/notion', () => ({
  createTaskRecord: vi.fn().mockResolvedValue({ success: true }),
}));

import { generateTeamTasks } from '@/lib/team-tasks';
import { createTaskRecord } from '@/lib/notion';

describe('generateTeamTasks', () => {
  it('서비스별 업무 생성', async () => {
    const results = await generateTeamTasks(
      '해피치과',
      [{ serviceId: 'cafe-viral', quantity: 10 }],
      'parent-123'
    );

    expect(results).toHaveLength(1);
    expect(results[0].team).toBe('마케팅팀');
    expect(results[0].taskName).toContain('해피치과');
    expect(results[0].taskName).toContain('카페 바이럴');
    expect(results[0].taskName).toContain('10건/월');
    expect(results[0].success).toBe(true);
  });

  it('존재하지 않는 서비스ID는 건너뜀', async () => {
    const results = await generateTeamTasks(
      '해피치과',
      [{ serviceId: 'nonexistent' }],
      'parent-123'
    );
    expect(results).toHaveLength(0);
  });

  it('빈 서비스 배열 → 빈 결과', async () => {
    const results = await generateTeamTasks('해피치과', [], 'parent-123');
    expect(results).toHaveLength(0);
  });

  it('부분 실패 처리', async () => {
    const mockCreate = vi.mocked(createTaskRecord);
    mockCreate
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false, error: 'API 에러' });

    const results = await generateTeamTasks(
      '해피치과',
      [
        { serviceId: 'cafe-viral', quantity: 5 },
        { serviceId: 'blog-clinical', quantity: 3 },
      ],
      'parent-123'
    );

    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(false);
    expect(results[1].error).toBe('API 에러');
  });

  it('수량 없는 서비스의 타이틀 형식', async () => {
    vi.mocked(createTaskRecord).mockResolvedValue({ success: true });

    const results = await generateTeamTasks(
      '해피치과',
      [{ serviceId: 'web-homepage-build' }],
      'parent-123'
    );

    expect(results[0].taskName).toBe('신규: 해피치과 - 홈페이지 제작');
  });
});
