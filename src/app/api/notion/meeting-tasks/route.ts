import { createCipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { syncCheckedMeetingActions } from '@/lib/notion/meeting-tasks';

export const maxDuration = 300;
export const runtime = 'nodejs';

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function configuredSecret(): string {
  return (process.env.MEETING_AUTOMATION_SECRET || process.env.NOTION_AUTOMATION_SECRET || '').trim();
}

function setupSecret(): string {
  return (process.env.NOTION_WEBHOOK_SETUP_SECRET || '').trim();
}

function legacyAuthorized(request: NextRequest): boolean {
  const secret = configuredSecret();
  const provided = request.headers.get('x-automation-secret') || '';
  return Boolean(secret && provided && safeEqual(secret, provided));
}

function setupAuthorized(request: NextRequest): boolean {
  const secret = setupSecret();
  const provided = request.nextUrl.searchParams.get('setup') || '';
  return Boolean(secret && provided && safeEqual(secret, provided));
}

export function validNotionSignature(rawBody: string, signature: string | null): boolean {
  const token = (process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN || '').trim();
  if (!token || !signature) return false;
  const expected = `sha256=${createHmac('sha256', token).update(rawBody).digest('hex')}`;
  return safeEqual(expected, signature);
}

function encryptVerificationToken(token: string, secret: string): string {
  const key = createHash('sha256').update(secret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64url');
}

function findPageId(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const compact = value.replace(/-/g, '');
    const match = compact.match(/[0-9a-f]{32}/i);
    if (!match) return undefined;
    const id = match[0];
    return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findPageId(item);
      if (found) return found;
    }
    return undefined;
  }
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    for (const key of ['page_id', 'pageId', 'entity', 'id', 'url', 'data']) {
      if (key in object) {
        const found = findPageId(object[key]);
        if (found) return found;
      }
    }
    for (const nested of Object.values(object)) {
      const found = findPageId(nested);
      if (found) return found;
    }
  }
  return undefined;
}

function isSupportedEvent(body: Record<string, unknown>): boolean {
  const type = body.type;
  return type === undefined || type === 'page.content_updated' || type === 'page.properties_updated';
}

function botOnlyEvent(body: Record<string, unknown>): boolean {
  const authors = body.authors;
  return Array.isArray(authors) && authors.length > 0 && authors.every((author) => {
    if (!author || typeof author !== 'object') return false;
    const type = (author as Record<string, unknown>).type;
    return type === 'bot' || type === 'agent';
  });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  let body: Record<string, unknown>;
  try {
    const parsed = JSON.parse(rawBody) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid body');
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const verificationToken = body.verification_token;
  if (typeof verificationToken === 'string') {
    if (!setupAuthorized(request) && !legacyAuthorized(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const secret = setupSecret() || configuredSecret();
    // The one-time token is encrypted before it enters Vercel logs. It can be
    // decrypted locally during subscription setup without exposing plaintext.
    console.info(`[notion-webhook-verification] ${encryptVerificationToken(verificationToken, secret)}`);
    return NextResponse.json({ success: true, verificationReceived: true });
  }

  const signed = validNotionSignature(rawBody, request.headers.get('x-notion-signature'));
  const fallbackSetupAuth = !(process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN || '').trim()
    && setupAuthorized(request);
  if (!signed && !legacyAuthorized(request) && !fallbackSetupAuth) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (!isSupportedEvent(body) || botOnlyEvent(body)) {
    return NextResponse.json({ success: true, ignored: true });
  }

  const meetingId = findPageId(body);
  if (!meetingId) {
    return NextResponse.json({ success: false, error: '미팅 페이지 ID를 찾을 수 없습니다.' }, { status: 400 });
  }

  try {
    const result = await syncCheckedMeetingActions(meetingId);
    // Domain validation errors are already written back to the meeting page,
    // so acknowledge them. Only unexpected infrastructure failures receive a
    // retryable 5xx response from this endpoint.
    return NextResponse.json({ success: true, processed: true, meetingId, result });
  } catch (error) {
    console.error('[meeting-tasks] action sync failed', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { success: false, error: '일시적인 처리 오류입니다. Notion이 다시 시도합니다.' },
      { status: 503 },
    );
  }
}

