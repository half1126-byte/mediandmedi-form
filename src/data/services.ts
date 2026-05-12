export const SERVICES = [
  // 마케팅팀
  { id: 'place-top', name: '플레이스 상위노출', team: '마케팅팀', hasQuantity: false, unit: '' },
  { id: 'place-manage', name: '플레이스 관리', team: '마케팅팀', hasQuantity: false, unit: '' },
  { id: 'danggeun-viral', name: '당근 바이럴', team: '마케팅팀', hasQuantity: true, unit: '건/월' },
  { id: 'danggeun-review', name: '당근 후기+단골', team: '마케팅팀', hasQuantity: true, unit: '건/월' },
  { id: 'cafe-viral', name: '카페 바이럴', team: '마케팅팀', hasQuantity: true, unit: '건/월' },
  { id: 'cafe-reply', name: '카페 댓글 붙이기', team: '마케팅팀', hasQuantity: true, unit: '건/월' },
  { id: 'blog-index', name: '블로그 지수작업', team: '마케팅팀', hasQuantity: true, unit: '개' },
  { id: 'blog-top', name: '블로그 상위노출', team: '마케팅팀', hasQuantity: false, unit: '' },
  { id: 'press', name: '언론보도', team: '마케팅팀', hasQuantity: true, unit: '건/월' },
  { id: 'receipt-review', name: '영수증 리뷰', team: '마케팅팀', hasQuantity: true, unit: '건/월' },
  { id: 'reservation-review', name: '예약 리뷰', team: '마케팅팀', hasQuantity: true, unit: '건/월' },
  { id: 'instagram', name: '인스타그램', team: '마케팅팀', hasQuantity: false, unit: '' },
  { id: 'cx-manage', name: '환자경험관리', team: '마케팅팀', hasQuantity: false, unit: '' },
  { id: 'search-ad', name: '검색광고', team: '마케팅팀', hasQuantity: false, unit: '' },
  { id: 'autocomplete', name: '자동완성', team: '마케팅팀', hasQuantity: false, unit: '' },
  { id: 'knowledge-in', name: '지식인', team: '마케팅팀', hasQuantity: true, unit: '건/월' },
  { id: 'experience', name: '체험단', team: '마케팅팀', hasQuantity: true, unit: '건/월' },
  { id: 'opening-setup', name: '개원셋팅', team: '마케팅팀', hasQuantity: false, unit: '' },

  // 바이럴팀
  { id: 'blog-info', name: '정보성 블로그', team: '바이럴팀', hasQuantity: true, unit: '건/월' },
  { id: 'blog-clinical', name: '임상 블로그', team: '바이럴팀', hasQuantity: true, unit: '건/월' },
  { id: 'cafe-partner-info', name: '카페 제휴-정보성', team: '바이럴팀', hasQuantity: true, unit: '건/월' },
  { id: 'cafe-partner-clinical', name: '카페 제휴-임상', team: '바이럴팀', hasQuantity: true, unit: '건/월' },
  { id: 'blog-keyword', name: '블로그 키워드 관리', team: '바이럴팀', hasQuantity: false, unit: '' },

  // 디자인팀
  { id: 'design-photo', name: '사진촬영', team: '디자인팀', hasQuantity: false, unit: '' },
  { id: 'design-video', name: '영상촬영', team: '디자인팀', hasQuantity: false, unit: '' },
  { id: 'design-youtube', name: '유튜브', team: '디자인팀', hasQuantity: false, unit: '' },
  { id: 'design-manage', name: '디자인 관리', team: '디자인팀', hasQuantity: false, unit: '' },

  // 웹팀
  { id: 'web-homepage-build', name: '홈페이지 제작', team: '웹팀', hasQuantity: false, unit: '' },
  { id: 'web-homepage-manage', name: '홈페이지 관리', team: '웹팀', hasQuantity: false, unit: '' },
  { id: 'web-popup', name: '팝업관리', team: '웹팀', hasQuantity: false, unit: '' },
] as const;

export type ServiceId = typeof SERVICES[number]['id'];

export const TEAMS = ['마케팅팀', '바이럴팀', '디자인팀', '웹팀'] as const;
