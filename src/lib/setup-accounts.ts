export const SETUP_ACCOUNTS = [
  ['naver', '네이버'], ['google', '구글'], ['kakao', '카카오'],
  ['dentalAd', '대한치과협회 의료광고심의'],
] as const;

export type SetupAccount = { id?: string; pw?: string; status?: 'provided' | 'create' };

export function setupAccountsComplete(accounts: Partial<Record<typeof SETUP_ACCOUNTS[number][0], SetupAccount>> | undefined): boolean {
  return SETUP_ACCOUNTS.every(([key]) => {
    const account = accounts?.[key];
    return account?.status === 'create' || (account?.status === 'provided' &&
      typeof account.id === 'string' && !!account.id.trim() &&
      typeof account.pw === 'string' && !!account.pw.trim());
  });
}
