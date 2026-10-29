import { expect, it } from 'vitest';
import { marketingDirectionComplete, didInfoComplete } from '../../src/lib/marketing';
it('requires both selections and details for other', () => {
  expect(marketingDirectionComplete()).toBe(false);
  expect(marketingDirectionComplete({ marketingGoals: ['신규 환자 유입'] })).toBe(false);
  expect(marketingDirectionComplete({ marketingGoals: ['신규 환자 유입'], desiredChannels: ['네이버 블로그'] })).toBe(true);
  expect(marketingDirectionComplete({ marketingGoals: ['기타'], desiredChannels: ['기타'] })).toBe(false);
  expect(marketingDirectionComplete({ marketingGoals: ['기타'], marketingGoalsOther: '목표', desiredChannels: ['기타'], desiredChannelsOther: '채널' })).toBe(true);
  expect(marketingDirectionComplete({ marketingGoals: ['1','2','3','4'], desiredChannels: ['블로그'] })).toBe(false);
});

it('requires DID information and accepts not installed', () => {
  expect(didInfoComplete()).toBe(false);
  expect(didInfoComplete({ didInfo: '  ' })).toBe(false);
  expect(didInfoComplete({ didInfo: '미설치' })).toBe(true);
  expect(didInfoComplete({ didInfo: '대기실 가로 1대' })).toBe(true);
});
