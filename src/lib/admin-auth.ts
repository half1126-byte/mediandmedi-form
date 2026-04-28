import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * 관리자 API 토큰 인증
 * 환경변수 ADMIN_TOKEN이 설정되어 있으면 Authorization 헤더 검증
 * 프로덕션에서 미설정 시 접근 차단
 */
export function verifyAdminToken(request: NextRequest): NextResponse | null {
  const token = process.env.ADMIN_TOKEN;
  if (!token) {
    // 프로덕션에서는 토큰 필수
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { success: false, error: 'ADMIN_TOKEN 환경변수 미설정' },
        { status: 500 }
      );
    }
    return null; // 개발 모드에서만 통과
  }

  const auth = request.headers.get('authorization') || '';
  const expected = `Bearer ${token}`;

  if (!safeCompare(auth, expected)) {
    return NextResponse.json(
      { success: false, error: '인증 필요' },
      { status: 401 }
    );
  }
  return null; // 인증 성공
}
