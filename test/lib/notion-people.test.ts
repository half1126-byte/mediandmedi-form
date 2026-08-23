import { describe, expect, it } from 'vitest';

import { linkedPersonAccountId } from '@/lib/notion/people';

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

