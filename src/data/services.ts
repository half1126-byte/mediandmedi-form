export const SERVICES = [
  { id: 'cafe-viral', name: '카페바이럴', team: '카페팀', hasQuantity: true, unit: '건/월' },
  { id: 'cafe-monitoring', name: '카페모니터링', team: '카페팀', hasQuantity: false, unit: '' },
  { id: 'danggeun', name: '당근마켓', team: '카페팀', hasQuantity: true, unit: '건/월' },
  { id: 'blog-index', name: '블로그지수', team: '블로그팀', hasQuantity: true, unit: '개' },
  { id: 'blog-clinical', name: '블로그작성(임상)', team: '블로그팀', hasQuantity: true, unit: '건/월' },
  { id: 'blog-info', name: '블로그작성(정보성)', team: '블로그팀', hasQuantity: true, unit: '건/월' },
  { id: 'design-homepage', name: '홈페이지 디자인', team: '디자인팀', hasQuantity: false, unit: '' },
  { id: 'design-schedule', name: '진료일정 디자인', team: '디자인팀', hasQuantity: false, unit: '' },
  { id: 'design-smartplace', name: '네이버 스마트플레이스 시안', team: '디자인팀', hasQuantity: false, unit: '' },
  { id: 'design-etc', name: '디자인 기타', team: '디자인팀', hasQuantity: false, unit: '' },
] as const;

export type ServiceId = typeof SERVICES[number]['id'];

export const TEAMS = ['카페팀', '블로그팀', '디자인팀'] as const;
