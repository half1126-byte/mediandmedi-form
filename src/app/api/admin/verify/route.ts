import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// In-memory rate limit (서버리스 인스턴스별로 별도이나 brute-force 속도 제한 효과는 충분)
// IP별 분당 5회 실패 시 60초 차단
const RATE_WINDOW_MS = 60_000;
const MAX_FAILS = 5;
const BLOCK_MS = 60_000;

interface RateState {
  fails: number[];      // 실패 시각 timestamps
  blockedUntil: number; // 차단 해제 시각 (0이면 허용)
}

const rateMap = new Map<string, RateState>();

function getClientIp(request: NextRequest): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const state = rateMap.get(ip) || { fails: [], blockedUntil: 0 };

  if (state.blockedUntil > now) {
    return { allowed: false, retryAfter: Math.ceil((state.blockedUntil - now) / 1000) };
  }

  // window 밖 시도는 만료 처리
  state.fails = state.fails.filter((t) => now - t < RATE_WINDOW_MS);
  rateMap.set(ip, state);
  return { allowed: true };
}

function recordFailure(ip: string) {
  const now = Date.now();
  const state = rateMap.get(ip) || { fails: [], blockedUntil: 0 };
  state.fails = state.fails.filter((t) => now - t < RATE_WINDOW_MS);
  state.fails.push(now);
  if (state.fails.length >= MAX_FAILS) {
    state.blockedUntil = now + BLOCK_MS;
    state.fails = [];
  }
  rateMap.set(ip, state);
}

function recordSuccess(ip: string) {
  rateMap.delete(ip);
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  // Rate limit 체크
  const rateCheck = checkRateLimit(ip);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { success: false, error: `너무 많은 시도입니다. ${rateCheck.retryAfter}초 후 다시 시도해 주세요.` },
      { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfter) } }
    );
  }

  const token = process.env.ADMIN_TOKEN;
  const expectedUser = process.env.ADMIN_USER || 'admin';
  if (!token) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ success: false, error: 'ADMIN_TOKEN 미설정' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  let body: { username?: string; token?: string };
  try {
    body = (await request.json()) as { username?: string; token?: string };
  } catch {
    recordFailure(ip);
    return NextResponse.json({ success: false, error: '잘못된 요청' }, { status: 400 });
  }

  // 아이디 + 비밀번호 둘 다 일치해야 통과 (상수시간 비교)
  if (
    body.username &&
    body.token &&
    safeCompare(body.username, expectedUser) &&
    safeCompare(body.token, token)
  ) {
    recordSuccess(ip);
    return NextResponse.json({ success: true });
  }

  recordFailure(ip);
  return NextResponse.json(
    { success: false, error: '아이디 또는 비밀번호가 맞지 않습니다' },
    { status: 401 }
  );
}
