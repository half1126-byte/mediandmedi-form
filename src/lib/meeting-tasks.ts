export type MeetingTeam = '마케팅팀' | '바이럴팀' | '디자인팀' | '웹팀';

const IGNORE = /^(액션\s*아이템|후속\s*(업무|작업)|없음|해당\s*없음|확정\s*신규\s*업무\s*없음)[:：]?$/i;

export function preprocessActionItems(raw: string): string[] {
  const normalized = raw
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/\r\n?/g, '\n');

  const source = normalized.includes('\n') ? normalized.split('\n') : normalized.split(/\s*;\s*/);
  const seen = new Set<string>();
  const items: string[] = [];

  for (const line of source) {
    const item = line
      .replace(/^\s*(?:[-*•·]|\d+[.)])\s*/, '')
      .replace(/^\s*\[[ xX]\]\s*/, '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[.;]+$/, '')
      .trim();

    if (!item || IGNORE.test(item)) continue;
    if (item.length < 3 || item.length > 200) {
      throw new Error(`액션 아이템은 3~200자로 작성해야 합니다: ${item.slice(0, 60)}`);
    }
    const key = item.toLocaleLowerCase('ko-KR');
    if (!seen.has(key)) {
      seen.add(key);
      items.push(item);
    }
  }

  if (items.length > 30) throw new Error('한 미팅에서 생성할 업무는 최대 30개입니다.');
  return items;
}

const KEYWORDS: Record<MeetingTeam, string[]> = {
  '웹팀': ['홈페이지', '웹사이트', '랜딩페이지', '도메인', '서버', '개발', '퍼블리싱', '코딩', '웹 기능', '게시판'],
  '디자인팀': ['디자인', '이미지', '배너', '현수막', '인쇄', '리플렛', '포스터', '카드뉴스', '썸네일', 'pop', '약도', 'did', '템플릿', '스킨'],
  '바이럴팀': ['바이럴', '맘카페', '커뮤니티', '카페 제휴', '지식인', '체험단'],
  '마케팅팀': ['플레이스', '광고', '마케팅', '견적', '기획', '보고', '운영', '이벤트', '채널', '블로그', '콘텐츠', '예약', '카카오', '당근', '홍보', '교육', '모니터링', '순위', '칼럼', '언론보도', '자료 요청', '자료 취합', '고객 안내'],
};

const UNSUPPORTED = ['영상', '촬영', '숏폼', '유튜브', '릴스', '영상 편집', '시나리오'];

export function classifyMeetingTask(text: string): MeetingTeam {
  const value = text.toLocaleLowerCase('ko-KR');
  if (UNSUPPORTED.some((keyword) => value.includes(keyword))) {
    throw new Error(`영상팀은 현재 (신)업무DB 담당팀 선택지에 없어 자동 배분할 수 없습니다: ${text}`);
  }

  const matches = (Object.keys(KEYWORDS) as MeetingTeam[])
    .filter((team) => KEYWORDS[team].some((keyword) => value.includes(keyword.toLocaleLowerCase('ko-KR'))));

  const specialized = matches.filter((team) => team !== '마케팅팀');
  if (specialized.length > 1) {
    throw new Error(`담당팀이 모호합니다(${specialized.join(', ')}): ${text}`);
  }
  if (specialized.length === 1) return specialized[0];
  if (matches.includes('마케팅팀')) return '마케팅팀';
  throw new Error(`담당팀을 판정할 핵심어가 없습니다: ${text}`);
}
