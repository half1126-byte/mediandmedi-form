import { expect, it } from 'vitest';
import { setupAccountsComplete } from '@/lib/setup-accounts';

it('네 계정의 상태를 모두 선택해야 한다', () => {
  expect(setupAccountsComplete(undefined)).toBe(false);
  expect(setupAccountsComplete({ naver: { status: 'create' } })).toBe(false);
  expect(setupAccountsComplete({ naver: { status: 'create' }, google: { status: 'create' }, kakao: { status: 'create' }, dentalAd: { status: 'create' } })).toBe(true);
});

it('입력을 선택하면 아이디와 비밀번호 모두 필요하며 기존 값만으로 상태를 대신하지 않는다', () => {
  const others = { google: { status: 'create' as const }, kakao: { status: 'create' as const }, dentalAd: { status: 'create' as const } };
  expect(setupAccountsComplete({ ...others, naver: { id: 'test', pw: 'test' } })).toBe(false);
  expect(setupAccountsComplete({ ...others, naver: { status: 'provided', id: 'test', pw: ' ' } })).toBe(false);
  expect(setupAccountsComplete({ ...others, naver: { status: 'provided', id: 'test', pw: 'test' } })).toBe(true);
});

it('의료광고심의 계정도 상태와 선택한 입력 정보를 확인한다', () => {
  const accounts = { naver: { status: 'create' as const }, google: { status: 'create' as const }, kakao: { status: 'create' as const } };
  expect(setupAccountsComplete(accounts)).toBe(false);
  expect(setupAccountsComplete({ ...accounts, dentalAd: { status: 'provided', id: 'test', pw: '' } })).toBe(false);
  expect(setupAccountsComplete({ ...accounts, dentalAd: { status: 'provided', id: 'test', pw: 'test' } })).toBe(true);
});
