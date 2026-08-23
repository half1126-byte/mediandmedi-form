/* eslint-disable @typescript-eslint/no-explicit-any -- Notion property unions are validated at runtime. */

/**
 * Returns the native Notion user selected in a PeopleDB row.
 *
 * `사람명` is only a display label and may intentionally differ from the
 * workspace account name. Assignment must therefore use the stable user ID
 * stored in the `사람` people property.
 */
export function linkedPersonAccountId(page: any, context: string): string {
  const accounts = page?.properties?.['사람']?.people;
  if (!Array.isArray(accounts) || accounts.length !== 1) {
    const count = Array.isArray(accounts) ? accounts.length : 0;
    throw new Error(`${context}의 사람DB '사람' 계정을 정확히 1개 연결해야 합니다. 현재 ${count}개입니다.`);
  }

  const accountId = accounts[0]?.id;
  if (typeof accountId !== 'string' || !accountId.trim()) {
    throw new Error(`${context}의 사람DB '사람' 계정 ID를 확인할 수 없습니다.`);
  }
  return accountId;
}

/** Checks the operational routing role instead of the employee's HR team. */
export function isActiveRoutingOwner(page: any, team: string): boolean {
  const active = page?.properties?.['재직상태']?.select?.name === '재직';
  const routingTeams = page?.properties?.['업무 배분 담당팀']?.multi_select;
  return active && Array.isArray(routingTeams)
    && routingTeams.some((option: any) => option?.name === team);
}

/* eslint-enable @typescript-eslint/no-explicit-any */

