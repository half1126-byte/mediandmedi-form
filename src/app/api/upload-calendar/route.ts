import { NextRequest, NextResponse } from 'next/server';
import { uploadFileToNotion } from '@/lib/notion';

export const runtime = 'nodejs';

// 진료일정 달력 이미지를 노션에 직접 업로드(file_upload) → file_upload id 반환.
// (기존 FTP 업로드 폐기 — Vercel↔FTP 권한 문제로 불안정했음. 클라이언트가 webp 저용량으로 보냄)
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('image') as File | null;
    if (!file) return NextResponse.json({ success: false, error: '이미지 없음' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const contentType = file.type || 'image/webp';
    const fileUploadId = await uploadFileToNotion(buffer, contentType);

    return NextResponse.json({ success: true, fileUploadId });
  } catch (err) {
    console.error('[upload-calendar]', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : '업로드 실패' },
      { status: 500 }
    );
  }
}
