import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';

const authKey = process.env.NOTION_MEETING_API_KEY || process.env.NOTION_API_KEY;
const isDemoMode = !authKey || !process.env.NOTION_MAIN_DB_ID;

const notion = authKey ? new Client({ auth: authKey }) : null;

/**
 * OLD 🏥 거래처 DB의 모든 거래처 페이지를 조회해 거래처명(title) 리스트를 반환.
 * 폼의 거래처명 자동완성에 사용 — 사용자가 직접 타이핑하지 않고 선택하게 해
 * 미팅 DB·진료일정 DB의 거래처 relation 매칭 실패를 방지.
 */
export async function GET() {
  if (isDemoMode || !notion) {
    return NextResponse.json({
      success: true,
      clinicNames: ['서울바른치과', '강남스마일치과', '연세밝은치과'],
      demo: true,
    });
  }

  try {
    // OLD 🏥 거래처 데이터 소스 ID (단일 소스 DB)
    const dataSourceId = '3539a82d-b9c4-81fd-9806-000b3103c7cf';
    const names: string[] = [];
    let cursor: string | undefined;

    // 페이지네이션으로 전체 조회 (최대 200건까지)
    for (let i = 0; i < 4; i++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res: any = await notion.dataSources.query({
        data_source_id: dataSourceId,
        page_size: 100,
        start_cursor: cursor,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const page of (res.results as any[])) {
        const titleArr = page.properties?.['거래처명']?.title || [];
        const name = titleArr.map((t: { plain_text: string }) => t.plain_text).join('');
        if (name) names.push(name);
      }

      if (!res.has_more) break;
      cursor = res.next_cursor;
    }

    // 중복 제거 + 가나다 정렬
    const unique = Array.from(new Set(names)).sort((a, b) => a.localeCompare(b, 'ko'));
    return NextResponse.json({ success: true, clinicNames: unique });
  } catch (err) {
    console.error('[clinic-names] query failed:', err);
    return NextResponse.json({ success: true, clinicNames: [] });
  }
}
