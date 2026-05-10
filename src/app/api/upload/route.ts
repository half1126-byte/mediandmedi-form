import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'basic-ftp';
import { Readable } from 'stream';

export const runtime = 'nodejs';
export const maxDuration = 60;

// SVG는 active content(JS) 가능 → 보안상 제외. 모든 카테고리 png/jpg/pdf만 허용.
const ALLOWED_EXTENSIONS: Record<string, string[]> = {
  logo: ['png', 'jpg', 'jpeg'],
  license: ['pdf', 'jpg', 'jpeg', 'png'],
  certificate: ['pdf', 'jpg', 'jpeg', 'png'],
  blueprint: ['pdf', 'jpg', 'jpeg', 'png'],
  business: ['pdf', 'jpg', 'jpeg', 'png'],
  permit: ['pdf', 'jpg', 'jpeg', 'png'],
  signage: ['jpg', 'jpeg', 'png'],
  banner: ['jpg', 'jpeg', 'png'],
  construction: ['jpg', 'jpeg', 'png'],
  career: ['jpg', 'jpeg', 'png'],
};

const ALLOWED_CATEGORIES = Object.keys(ALLOWED_EXTENSIONS);

const MAX_SIZE: Record<string, number> = {
  blueprint: 50 * 1024 * 1024, // 3D 도면은 50MB
  default: 30 * 1024 * 1024,    // 기타 30MB
};

const MAX_SIZE_HARD = 50 * 1024 * 1024;

function sanitizeFilename(name: string): string {
  return name.replace(/[^\w가-힣.\-]/g, '_');
}

// 카테고리 검증: 화이트리스트만 허용 (path traversal 방지)
function isValidCategory(c: string): boolean {
  return ALLOWED_CATEGORIES.includes(c);
}

// 치과명 sanitize: 슬래시/점 제거 (path traversal 추가 방지)
function sanitizeClinicName(name: string): string {
  const stripped = name.replace(/[\/\\.]/g, '_');
  return sanitizeFilename(stripped) || '미정';
}

export async function POST(request: NextRequest) {
  // Content-Length 사전 검증 (메모리 보호)
  const contentLengthHeader = request.headers.get('content-length');
  if (contentLengthHeader) {
    const len = parseInt(contentLengthHeader, 10);
    if (!isNaN(len) && len > MAX_SIZE_HARD + 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: '요청 크기 초과 (최대 50MB)' },
        { status: 413 }
      );
    }
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ success: false, error: '잘못된 요청' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  const category = (formData.get('category') as string) || '';
  const clinicName = (formData.get('clinicName') as string) || '';

  if (!file) {
    return NextResponse.json({ success: false, error: '파일이 없습니다' }, { status: 400 });
  }

  // 카테고리 화이트리스트 검증 (path traversal 방지)
  if (!isValidCategory(category)) {
    return NextResponse.json(
      { success: false, error: `허용되지 않은 카테고리입니다` },
      { status: 400 }
    );
  }

  // 형식 검증
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const allowed = ALLOWED_EXTENSIONS[category];
  if (!allowed.includes(ext)) {
    return NextResponse.json(
      { success: false, error: `허용되지 않는 파일 형식입니다 (${allowed.join(', ')})` },
      { status: 400 }
    );
  }

  // 크기 검증
  const limit = MAX_SIZE[category] || MAX_SIZE.default;
  if (file.size > limit) {
    return NextResponse.json(
      { success: false, error: `파일 크기 초과 (최대 ${limit / 1024 / 1024}MB)` },
      { status: 413 }
    );
  }

  // 환경변수 검증
  const host = process.env.FTP_HOST;
  const user = process.env.FTP_USER;
  const pass = process.env.FTP_PASS;
  const uploadPath = process.env.FTP_UPLOAD_PATH || '/www/planner/uploads';
  const publicUrl = process.env.FTP_PUBLIC_URL || 'https://medischedule.co.kr/uploads';

  if (!host || !user || !pass) {
    return NextResponse.json(
      { success: false, error: 'FTP 환경변수 미설정' },
      { status: 500 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const safeFilename = sanitizeFilename(file.name);
  const safeClinicName = sanitizeClinicName(clinicName);
  const dateStr = new Date().toISOString().slice(0, 10);
  const timestamp = Date.now();

  // 폴더 구조: /uploads/{category}/{clinicName_date}/{timestamp-filename}
  // category와 safeClinicName 모두 검증/sanitize 완료
  const remoteDir = `${uploadPath}/${category}/${safeClinicName}_${dateStr}`;
  const remotePath = `${remoteDir}/${timestamp}-${safeFilename}`;

  const client = new Client(30000);
  client.ftp.verbose = false;

  try {
    await client.access({
      host,
      user,
      password: pass,
      secure: false, // 호스팅 서버가 FTPS 미지원 → 일반 FTP
    });

    await client.ensureDir(remoteDir);
    await client.uploadFrom(Readable.from(buffer), `${timestamp}-${safeFilename}`);

    // 공개 URL 구성
    const url = `${publicUrl}/${category}/${safeClinicName}_${dateStr}/${timestamp}-${safeFilename}`;

    return NextResponse.json({
      success: true,
      url,
      filename: file.name,
      remotePath,
      size: file.size,
    });
  } catch (error) {
    console.error('[FTP Upload] 실패:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '업로드 실패',
      },
      { status: 500 }
    );
  } finally {
    client.close();
  }
}
