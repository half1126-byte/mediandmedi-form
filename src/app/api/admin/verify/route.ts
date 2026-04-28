import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function POST(request: NextRequest) {
  const token = process.env.ADMIN_TOKEN;
  if (!token) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ success: false, error: 'ADMIN_TOKEN 미설정' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  const body = await request.json() as { token?: string };
  if (body.token && safeCompare(body.token, token)) {
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ success: false, error: '비밀번호가 맞지 않습니다' }, { status: 401 });
}
