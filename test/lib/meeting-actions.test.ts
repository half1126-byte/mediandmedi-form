import { describe, expect, it } from 'vitest';
import {
  MeetingActionParseError,
  classifyMeetingActionByKeywords,
  getRichTextDisplayText,
  parseMeetingActionItem,
  parseCheckedActionTodos,
  selectCheckedActionItems,
  type NotionToDoBlockLike,
} from '@/lib/meeting-actions';

const todo = (
  id: string,
  text: string,
  checked = true,
): NotionToDoBlockLike => ({
  id,
  type: 'to_do',
  to_do: { checked, rich_text: [{ plain_text: text }] },
});

describe('meeting action parser', () => {
  it('uses Notion visible text and normalizes Markdown links', () => {
    expect(getRichTextDisplayText([{ text: { content: '[랜딩 페이지](https://example.com)' } }]))
      .toBe('랜딩 페이지');
  });

  it('parses an explicit team, alias, task, due date, and evidence', () => {
    expect(parseMeetingActionItem(todo(
      'block-a',
      '[웹퍼블리셔팀] [신규 랜딩](https://example.com) 수정 | 근거: 전환율 개선 | 마감일: 2026-08-31',
    ))).toEqual({
      blockId: 'block-a',
      team: '웹팀',
      taskName: '신규 랜딩 수정',
      originalText: '[웹퍼블리셔팀] 신규 랜딩 수정 | 근거: 전환율 개선 | 마감일: 2026-08-31',
      evidenceText: '전환율 개선',
      dueDateText: '2026-08-31',
    });
  });

  it('rejects missing or invalid prefixes and invalid task lengths', () => {
    expect(() => parseMeetingActionItem(todo('missing', '홈페이지 수정')))
      .toThrow(/팀 접두어/);
    expect(() => parseMeetingActionItem(todo('unknown', '[개발팀] 홈페이지 수정')))
      .toThrow(MeetingActionParseError);
    expect(() => parseMeetingActionItem(todo('short', '[웹팀] A | 마감일: 내일')))
      .toThrow(/3~200자/);
  });

  it('classifies only a unique keyword match', () => {
    expect(classifyMeetingActionByKeywords('릴스 영상 편집')).toBe('영상팀');
    expect(() => classifyMeetingActionByKeywords('홈페이지 배너 디자인'))
      .toThrow(/모호/);
    expect(() => classifyMeetingActionByKeywords('회의 참석'))
      .toThrow(/찾을 수 없습니다/);
  });

  it('selects checked unique to-dos only, reports unprefixed entries, and caps at 30', () => {
    const blocks: NotionToDoBlockLike[] = [
      todo('unchecked', '[마케팅팀] 광고 문구 검토', false),
      todo('missing-team', '블로그 콘텐츠 작성'),
      todo('first', '[바이럴팀] 블로그 콘텐츠 작성'),
      todo('first', '[디자인팀] 중복 블록은 무시'),
      { id: 'paragraph', type: 'paragraph', to_do: { checked: true, rich_text: [{ plain_text: '[웹팀] 무시' }] } },
      ...Array.from({ length: 31 }, (_, index) => todo(`bulk-${index}`, `[영상팀] 영상 편집 ${index}`)),
    ];

    const result = selectCheckedActionItems(blocks);
    expect(result.items).toHaveLength(30);
    expect(result.items[0]).toMatchObject({ blockId: 'first', team: '바이럴팀' });
    expect(result.items.map((item) => item.blockId)).not.toContain('unchecked');
    expect(result.items.map((item) => item.blockId)).not.toContain('paragraph');
    expect(result.errors).toEqual([
      { blockId: 'missing-team', message: expect.stringMatching(/팀 접두어/) },
    ]);
  });

  it('provides the importer-facing checked-candidate contract without team inference', () => {
    expect(parseCheckedActionTodos([
      { blockId: 'unchecked', text: '광고 카피 작성', checked: false },
      { blockId: 'unprefixed', text: '광고 카피 작성', checked: true },
      { blockId: 'good', text: '[마케팅팀] 광고 카피 작성 | 근거: 신제품 출시 | 마감일: 금요일', checked: true },
      { blockId: 'good', text: '[영상팀] 중복은 무시', checked: true },
    ])).toEqual({
      actions: [{
        blockId: 'good',
        team: '마케팅팀',
        title: '광고 카피 작성',
        rawText: '[마케팅팀] 광고 카피 작성 | 근거: 신제품 출시 | 마감일: 금요일',
        reason: '신제품 출시',
        deadlineText: '금요일',
      }],
      errors: [expect.stringMatching(/^\[unprefixed\].*팀 접두어/)],
    });
  });

  it('reports importer overflow instead of silently dropping checked work', () => {
    const result = parseCheckedActionTodos(
      Array.from({ length: 31 }, (_, index) => ({
        blockId: `overflow-${index}`,
        text: `[영상팀] 영상 편집 ${index}`,
        checked: true,
      })),
    );

    expect(result.actions).toHaveLength(30);
    expect(result.errors).toContainEqual(expect.stringMatching(/최대 30개/));
  });
});

