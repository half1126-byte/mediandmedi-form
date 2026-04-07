import { NextResponse } from 'next/server';

const isDemoMode = !process.env.NOTION_API_KEY || !process.env.NOTION_SCHEDULE_DB_ID;

export async function GET() {
  if (isDemoMode) {
    return NextResponse.json({
      success: true,
      clinicNames: ['서울바른치과', '강남스마일치과', '연세밝은치과'],
      demo: true,
    });
  }

  try {
    // Notion DB 스키마에서 거래처명 select 옵션 조회
    const res = await fetch(
      `https://api.notion.com/v1/databases/${process.env.NOTION_SCHEDULE_DB_ID}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
          'Notion-Version': '2022-06-28',
        },
      }
    );

    if (!res.ok) {
      // DB 스키마 조회 실패 시 빈 배열 반환
      return NextResponse.json({ success: true, clinicNames: [] });
    }

    const db = await res.json();
    const prop = db.properties?.['거래처명'];

    if (prop?.type === 'select' && prop.select?.options) {
      const names = prop.select.options.map((o: { name: string }) => o.name);
      return NextResponse.json({ success: true, clinicNames: names });
    }

    return NextResponse.json({ success: true, clinicNames: [] });
  } catch {
    return NextResponse.json({ success: true, clinicNames: [] });
  }
}
