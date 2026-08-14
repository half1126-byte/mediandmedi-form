import { describe, expect, it } from 'vitest';
import { classifyMeetingTask, preprocessActionItems } from './meeting-tasks';

describe('preprocessActionItems', () => {
  it('normalizes recording/AI and manual list formats and deduplicates', () => {
    expect(preprocessActionItems('- [ ] 네이버 플레이스 수정<br>1. 홈페이지 배너 교체\n• 네이버 플레이스 수정')).toEqual([
      '네이버 플레이스 수정',
      '홈페이지 배너 교체',
    ]);
  });

  it('does not turn empty summaries into tasks', () => {
    expect(preprocessActionItems('액션 아이템\n없음\n확정 신규 업무 없음')).toEqual([]);
  });

  it('limits runaway task creation', () => {
    const raw = Array.from({ length: 31 }, (_, index) => `광고 점검 ${index}`).join('\n');
    expect(() => preprocessActionItems(raw)).toThrow('최대 30개');
  });
});

describe('classifyMeetingTask', () => {
  it('routes supported work deterministically', () => {
    expect(classifyMeetingTask('네이버 플레이스 정보 수정')).toBe('마케팅팀');
    expect(classifyMeetingTask('홈페이지 게시판 기능 개발')).toBe('웹팀');
    expect(classifyMeetingTask('카드뉴스 디자인 제작')).toBe('디자인팀');
    expect(classifyMeetingTask('맘카페 체험단 진행')).toBe('바이럴팀');
  });

  it('rejects unsupported or ambiguous work instead of guessing', () => {
    expect(() => classifyMeetingTask('유튜브 영상 편집')).toThrow('영상팀');
    expect(() => classifyMeetingTask('다음 주까지 처리')).toThrow('핵심어');
    expect(() => classifyMeetingTask('홈페이지 배너 디자인 개발')).toThrow('모호');
  });
});
