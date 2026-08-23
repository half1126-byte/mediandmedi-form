import { describe, expect, it } from 'vitest';

import { isActiveRoutingOwner, linkedPersonAccountId } from '@/lib/notion/people';

describe('linkedPersonAccountId', () => {
  it('uses the selected Notion account ID without comparing display names', () => {
    const page = {
      properties: {
        사람명: { title: [{ plain_text: '심지현' }] },
        사람: { people: [{ id: 'native-account-id', name: '지현' }] },
      },
    };

    expect(linkedPersonAccountId(page, '담당마케터 심지현')).toBe('native-account-id');
  });

  it.each([
    ['계정이 없을 때', []],
    ['계정이 여러 개일 때', [{ id: 'one' }, { id: 'two' }]],
  ])('%s 명확한 오류를 낸다', (_label, people) => {
    expect(() => linkedPersonAccountId({ properties: { 사람: { people } } }, '담당자'))
      .toThrow("사람DB '사람' 계정을 정확히 1개");
  });
});

describe('isActiveRoutingOwner', () => {
  it('allows an executive who is explicitly assigned to route marketing work', () => {
    const page = {
      properties: {
        소속팀: { select: { name: '경영진' } },
        재직상태: { select: { name: '재직' } },
        '업무 배분 담당팀': { multi_select: [{ name: '마케팅팀' }] },
      },
    };

    expect(isActiveRoutingOwner(page, '마케팅팀')).toBe(true);
  });

  it('rejects inactive or unassigned employees', () => {
    expect(isActiveRoutingOwner({ properties: {
      재직상태: { select: { name: '퇴사' } },
      '업무 배분 담당팀': { multi_select: [{ name: '마케팅팀' }] },
    } }, '마케팅팀')).toBe(false);
    expect(isActiveRoutingOwner({ properties: {
      재직상태: { select: { name: '재직' } },
      '업무 배분 담당팀': { multi_select: [] },
    } }, '마케팅팀')).toBe(false);
  });
});

