import { NextRequest, NextResponse } from 'next/server';
import * as ftp from 'basic-ftp';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('image') as File | null;
    if (!file) return NextResponse.json({ error: '이미지 없음' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = `calendar_${Date.now()}.png`;
    const ftpBasePath = process.env.FTP_UPLOAD_PATH || '/www/planner/uploads';
    const remotePath = `${ftpBasePath}/${filename}`;
    // /www/planner/uploads → /planner/uploads (웹루트 /www 제거)
    const webPath = ftpBasePath.replace(/^\/www/, '');
    const publicUrl = `http://medischedule.co.kr${webPath}/${filename}`;

    const client = new ftp.Client(30000);
    try {
      await client.access({
        host:     process.env.FTP_HOST     || 'medischedule.co.kr',
        user:     process.env.FTP_USER     || '',
        password: process.env.FTP_PASS     || '',
        secure:   false,
      });
      await client.uploadFrom(bufferToReadable(buffer), remotePath);
    } finally {
      client.close();
    }

    return NextResponse.json({ success: true, url: publicUrl });
  } catch (err) {
    console.error('[upload-calendar]', err);
    return NextResponse.json({ error: '업로드 실패' }, { status: 500 });
  }
}

function bufferToReadable(buffer: Buffer): import('stream').Readable {
  const { Readable } = require('stream');
  return Readable.from(buffer);
}
