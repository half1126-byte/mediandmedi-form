// 신규개원 세팅 42건 마스터 (v4) — 🏥개원세팅DB 자동 적재용.
// 정본: c:\Users\com\Downloads\신규세팅가이드\07_v4_42건_매핑_draft.md
// 모델: 풀스택 관제 + 제작 핸드오프. PM·마케팅팀=직접 / 디자인·웹·바이럴·영상=핸드오프((신)업무DB 의뢰).
// 정렬은 D오프셋(개원예정일 기준 상대일)으로만. 실제 날짜는 노션 Dday 수식이 처리.

/** 개원세팅DB의 국면 select 옵션과 정확히 일치해야 함. */
export type OpeningPhase =
  | '① 킥오프·준비'
  | '② 기반 제작'
  | '③ 인증·심의'
  | '③-B 콘텐츠·바이럴'
  | '④ 예약·연결·인쇄'
  | '⑤ 개원 점검'
  | '⑥ 운영 전환';

/** 개원세팅DB의 담당팀 select 옵션과 정확히 일치해야 함. */
export type OpeningTeam = '마케팅팀' | '디자인팀' | '웹팀' | 'PM' | '바이럴팀' | '영상팀';

export interface OpeningSetupTask {
  no: number;
  국면: OpeningPhase;
  업무명: string;
  담당팀: OpeningTeam;
  /** D오프셋: 개원예정일 기준 상대일(음수=개원 전, 0=개원일, 양수=개원 후). 정렬 키. */
  dOffset: number;
  /** true=마케팅팀이 (신)업무DB로 핸드오프(제작 의뢰), false=관제팀(PM/마케팅) 직접 수행. */
  handoff: boolean;
  /** true=계약 옵션 업무. 디자인팀 계약 시에만 생성(현재 No.28 영상만). */
  optional?: boolean;
}

export const OPENING_SETUP_TASKS: readonly OpeningSetupTask[] = [
  // ① 킥오프·준비
  { no: 1, 국면: '① 킥오프·준비', 업무명: '단톡방 개설·킥오프 미팅', 담당팀: 'PM', dOffset: -44, handoff: false },
  { no: 2, 국면: '① 킥오프·준비', 업무명: '자료·계정 취합(사업자·로고·면허·계정권한·사진)', 담당팀: 'PM', dOffset: -38, handoff: false },
  { no: 3, 국면: '① 킥오프·준비', 업무명: '홈피 원고 작성(진료과목·원장소개·오시는길)', 담당팀: 'PM', dOffset: -36, handoff: false },
  { no: 4, 국면: '① 킥오프·준비', 업무명: '역산 일정표 작성', 담당팀: 'PM', dOffset: -40, handoff: false },
  { no: 5, 국면: '① 킥오프·준비', 업무명: '거래처DB·노션 등록', 담당팀: 'PM', dOffset: -38, handoff: false },
  { no: 6, 국면: '① 킥오프·준비', 업무명: '도메인 구매·DNS·SSL 설정', 담당팀: '웹팀', dOffset: -38, handoff: true },
  // ② 기반 제작
  { no: 7, 국면: '② 기반 제작', 업무명: '브랜드 컬러·로고 가이드 정리', 담당팀: '디자인팀', dOffset: -35, handoff: true },
  { no: 8, 국면: '② 기반 제작', 업무명: '내비게이션 등록', 담당팀: '마케팅팀', dOffset: -30, handoff: false },
  { no: 9, 국면: '② 기반 제작', 업무명: '홈페이지 기획(IA·와이어프레임)', 담당팀: '웹팀', dOffset: -33, handoff: true },
  { no: 10, 국면: '② 기반 제작', 업무명: '홈페이지 UI 시안 제작', 담당팀: '웹팀', dOffset: -28, handoff: true },
  { no: 11, 국면: '② 기반 제작', 업무명: '홈페이지 제작(개발·반응형)', 담당팀: '웹팀', dOffset: -21, handoff: true },
  { no: 12, 국면: '② 기반 제작', 업무명: '홈페이지 의뢰처 검수·수정', 담당팀: '웹팀', dOffset: -19, handoff: true },
  { no: 13, 국면: '② 기반 제작', 업무명: 'GEO 심화 적용(스키마·robots·sitemap·NAP)', 담당팀: '웹팀', dOffset: -19, handoff: true },
  { no: 14, 국면: '② 기반 제작', 업무명: '개인정보처리방침 페이지 등록', 담당팀: '웹팀', dOffset: -20, handoff: true },
  { no: 15, 국면: '② 기반 제작', 업무명: '블로그 스킨·썸네일 제작', 담당팀: '디자인팀', dOffset: -36, handoff: true },
  { no: 16, 국면: '② 기반 제작', 업무명: '블로그 카테고리·프로필·스킨 세팅', 담당팀: '마케팅팀', dOffset: -39, handoff: false },
  { no: 17, 국면: '② 기반 제작', 업무명: '원내 사진 촬영 조율·진행', 담당팀: '마케팅팀', dOffset: -24, handoff: false },
  { no: 18, 국면: '② 기반 제작', 업무명: '디자인 1차(약력·진료시간·오시는길·1차 DID)', 담당팀: '디자인팀', dOffset: -25, handoff: true },
  { no: 19, 국면: '② 기반 제작', 업무명: '디자인 의뢰처 컨펌·수정', 담당팀: '디자인팀', dOffset: -23, handoff: true },
  // ③ 인증·심의
  { no: 20, 국면: '③ 인증·심의', 업무명: '검색엔진 등록·사이트맵 제출', 담당팀: '웹팀', dOffset: -19, handoff: true },
  { no: 21, 국면: '③ 인증·심의', 업무명: '포털 인증(네이버·카카오·구글 비즈니스)', 담당팀: '마케팅팀', dOffset: -5, handoff: false },
  { no: 22, 국면: '③ 인증·심의', 업무명: '의료광고 심의 접수', 담당팀: '마케팅팀', dOffset: -19, handoff: false },
  { no: 23, 국면: '③ 인증·심의', 업무명: '심의번호 기재·광고 문안 수정', 담당팀: '마케팅팀', dOffset: 90, handoff: false },
  // ③-B 콘텐츠·바이럴
  { no: 24, 국면: '③-B 콘텐츠·바이럴', 업무명: '플레이스용 이미지·썸네일·배너 제작', 담당팀: '디자인팀', dOffset: -10, handoff: true },
  { no: 25, 국면: '③-B 콘텐츠·바이럴', 업무명: '사전 콘텐츠 발행(블로그·카드뉴스)', 담당팀: '바이럴팀', dOffset: -38, handoff: true },
  { no: 26, 국면: '③-B 콘텐츠·바이럴', 업무명: '카페 바이럴·커뮤니티 세팅', 담당팀: '바이럴팀', dOffset: -40, handoff: true },
  { no: 27, 국면: '③-B 콘텐츠·바이럴', 업무명: '리뷰 동선·증정선물 안내물 제작', 담당팀: '디자인팀', dOffset: -11, handoff: true },
  { no: 28, 국면: '③-B 콘텐츠·바이럴', 업무명: '(옵션) 개원 영상·숏폼 기획·촬영·편집', 담당팀: '영상팀', dOffset: -10, handoff: true, optional: true },
  // ④ 예약·연결·인쇄
  { no: 29, 국면: '④ 예약·연결·인쇄', 업무명: '네이버 플레이스 등록·정보 세팅', 담당팀: '마케팅팀', dOffset: -2, handoff: false },
  { no: 30, 국면: '④ 예약·연결·인쇄', 업무명: '광고비 예산 확정·집행 승인', 담당팀: 'PM', dOffset: -7, handoff: false },
  { no: 31, 국면: '④ 예약·연결·인쇄', 업무명: '네이버 예약·톡톡·카카오 채널 연결', 담당팀: '마케팅팀', dOffset: -5, handoff: false },
  { no: 32, 국면: '④ 예약·연결·인쇄', 업무명: '홈페이지 외부 링크·팝업·퀵메뉴 연결', 담당팀: '웹팀', dOffset: -4, handoff: true },
  { no: 33, 국면: '④ 예약·연결·인쇄', 업무명: '촬영 보정본 반영(플레이스·홈피·2차 DID)', 담당팀: '디자인팀', dOffset: -4, handoff: true },
  { no: 34, 국면: '④ 예약·연결·인쇄', 업무명: '현수막·POP·인쇄물 발주·입고', 담당팀: '디자인팀', dOffset: -4, handoff: true },
  // ⑤ 개원 점검
  { no: 35, 국면: '⑤ 개원 점검', 업무명: '개원 최종점검(전 채널·전 팀)', 담당팀: 'PM', dOffset: -1, handoff: false },
  { no: 36, 국면: '⑤ 개원 점검', 업무명: '플레이스·홈페이지 노출 최종 확인', 담당팀: '마케팅팀', dOffset: 0, handoff: false },
  // ⑥ 운영 전환
  { no: 37, 국면: '⑥ 운영 전환', 업무명: '광고 소재 제작(운영용)', 담당팀: '디자인팀', dOffset: 3, handoff: true },
  { no: 38, 국면: '⑥ 운영 전환', 업무명: '검색·플레이스광고 세팅·집행', 담당팀: '마케팅팀', dOffset: 7, handoff: false },
  { no: 39, 국면: '⑥ 운영 전환', 업무명: '리뷰 활성화·관리(초기 집중)', 담당팀: '바이럴팀', dOffset: 30, handoff: true },
  { no: 40, 국면: '⑥ 운영 전환', 업무명: '콘텐츠 정기 발행(블로그·칼럼·숏폼)', 담당팀: '바이럴팀', dOffset: 90, handoff: true },
  { no: 41, 국면: '⑥ 운영 전환', 업무명: '순위·노출 베이스라인 측정', 담당팀: '마케팅팀', dOffset: 14, handoff: false },
  { no: 42, 국면: '⑥ 운영 전환', 업무명: '월간 운영 리포트', 담당팀: 'PM', dOffset: 90, handoff: false },
] as const;
