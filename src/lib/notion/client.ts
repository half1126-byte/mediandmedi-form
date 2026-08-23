import { Client, isNotionClientError } from '@notionhq/client';

// 환경변수의 공백/개행 제거 — Vercel 등에 복붙으로 값을 넣을 때 끝에 개행이 섞이면
// DB ID/키가 깨져 제출이 통째로 실패한다. 읽는 지점마다 trim.
export function envTrim(name: string): string | undefined {
  const v = (process.env[name] || '').trim();
  return v || undefined;
}

const authKey = envTrim('NOTION_MEETING_API_KEY') || envTrim('NOTION_API_KEY');

if (!authKey) {
  console.warn('[notion] NOTION_MEETING_API_KEY/NOTION_API_KEY 환경변수 미설정 — Notion 연동 비활성');
}

export const notion = new Client({
  auth: authKey || '',
});

export const DELAY_MS = 350;

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const isRateLimit = isNotionClientError(error) && 'status' in error && (error as { status: number }).status === 429;
      const isLastAttempt = attempt === maxRetries - 1;

      if (isLastAttempt) throw error;

      const backoff = isRateLimit
        ? DELAY_MS * Math.pow(2, attempt + 1)
        : 1000 * (attempt + 1);
      await delay(backoff);
    }
  }
  throw new Error('Max retries exceeded');
}

