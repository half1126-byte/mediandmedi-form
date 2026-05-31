import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCreate, mockRetrieve, mockSearch } = vi.hoisted(() => {
  return {
    mockCreate: vi.fn(),
    mockRetrieve: vi.fn(),
    mockSearch: vi.fn(),
  };
});

vi.mock('@notionhq/client', () => {
  return {
    Client: class MockClient {
      pages = {
        create: mockCreate,
        retrieve: mockRetrieve,
      };
      search = mockSearch;
    },
  };
});

vi.stubEnv('NOTION_API_KEY', 'test-key');
vi.stubEnv('NOTION_MAIN_DB_ID', 'main-db-id');
vi.stubEnv('NOTION_TASK_DB_ID', 'task-db-id');
vi.stubEnv('NOTION_CHANGE_DB_ID', 'change-db-id');

import { createMainRecord, createTaskRecord, createChangeRecord, getPageData } from '@/lib/notion';

const sampleFormData = {
  step1: { clinicName: '해피치과', doctorName: '김행복', openDate: '2026-05-01', region: { city: '서울특별시', district: '강남구' } },
  step2: { dentalSubjects: ['충치치료'], topSubjects: [], schedule: {}, holidays: [], holidayClose: false, lunchTime: { start: '12:00', end: '13:00' } },
  step3: { chairs: 3, equipment: [], facilities: [], parking: { available: '가능' } },
  step4: { hasProfilePhoto: false },
  step5: { referralSource: [], marketingGoals: [], desiredChannels: [] },
  step6: { services: [], isStarterPackage: false },
};

describe('createMainRecord', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearch.mockResolvedValue({ results: [] }); // 기본: 동일 거래처 없음 → 새로 생성
  });

  it('성공 시 페이지 ID 반환', async () => {
    mockCreate.mockResolvedValue({ id: 'page-123' });
    const id = await createMainRecord(sampleFormData);
    expect(id).toBe('page-123');
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('멱등성: 같은 거래처명이 이미 있으면 새로 만들지 않고 기존 페이지 ID 반환', async () => {
    mockSearch.mockResolvedValue({
      results: [
        { id: 'existing-page', parent: { database_id: 'main-db-id' }, properties: { '거래처명': { title: [{ plain_text: '해피치과' }] } } },
      ],
    });
    mockCreate.mockResolvedValue({ id: 'should-not-be-used' });
    const id = await createMainRecord(sampleFormData); // step1.clinicName = '해피치과'
    expect(id).toBe('existing-page');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('429 에러 시 재시도', async () => {
    const error429 = Object.assign(new Error('Rate limited'), { status: 429 });
    mockCreate
      .mockRejectedValueOnce(error429)
      .mockResolvedValue({ id: 'page-456' });

    const id = await createMainRecord(sampleFormData);
    expect(id).toBe('page-456');
    expect(mockCreate).toHaveBeenCalledTimes(2);
  }, 15000);

  it('3회 실패 시 에러 throw', async () => {
    mockCreate.mockRejectedValue(new Error('Server error'));
    await expect(createMainRecord(sampleFormData)).rejects.toThrow('Server error');
    expect(mockCreate).toHaveBeenCalledTimes(3);
  }, 30000);
});

describe('createTaskRecord', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('성공 시 { success: true }', async () => {
    mockCreate.mockResolvedValue({ id: 'task-1' });
    const result = await createTaskRecord({
      title: '신규: 해피치과 - 카페바이럴 10건/월',
      team: '카페팀',
      clinicName: '해피치과',
      detail: '상세내용',
      parentId: 'parent-1',
    });
    expect(result.success).toBe(true);
  });
});

describe('createChangeRecord', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('계약변경 레코드 생성', async () => {
    mockCreate.mockResolvedValue({ id: 'change-1' });
    const id = await createChangeRecord({
      clinicName: '해피치과',
      doctorName: '김행복',
      currentServices: ['카페바이럴'],
      addServices: ['블로그작성(임상)'],
      removeServices: [],
      reason: '채널 확대',
    });
    expect(id).toBe('change-1');
  });
});

describe('createMainRecord — 신규 필드 매핑 (디자인/브랜딩·홈페이지·브랜딩)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearch.mockResolvedValue({ results: [] }); // 동일 거래처 없음 → 새로 생성
  });

  // 페이지 본문 blocks 의 모든 텍스트를 한 문자열로 평탄화
  function bodyText(children: Array<Record<string, unknown>>): string {
    return children
      .map((b) => {
        const type = b.type as string;
        const node = (b[type] as { rich_text?: Array<{ text?: { content?: string } }> }) || {};
        return (node.rich_text || []).map((r) => r.text?.content || '').join('');
      })
      .join('\n');
  }

  const e2ePayload = {
    scope: { marketing: true, viral: false, web: true, logo: true, video: false },
    step1: { clinicName: 'E2E_테스트치과', doctorName: '테스트원장', openDate: '2026-12-01', region: { city: '서울특별시', district: '강남구' }, doctors: [{ name: '테스트원장', title: '원장', specialty: '보철과' }] },
    step2: { dentalSubjects: ['일반 임플란트', '투명교정'], customSubjects: '코골이 치료', topSubjects: ['일반 임플란트'], implantMaterials: { 오스템: ['SA'] }, alignerOptions: ['인비절라인', '기타'], alignerOther: '클리어라인', schedule: {}, holidays: [], holidayClose: true, lunchTime: { start: '12:30', end: '13:30' } },
    step3: { chairs: 5, equipment: ['CT(CBCT)'], equipmentDetail: '바텍 그린스마트 CT', facilities: ['수술실'], parking: { available: '가능', detail: '지하 20대' } },
    step4: { oneLiner: 'E2E 한줄', slogan: 'E2E 슬로건', brandVision: 'E2E 비전', brandTone: '따뜻·전문', brandColorTones: ['블루(신뢰·전문)'], brandColor: '네이비', benchmarkClinics: '트리움치과 / example.com', hasProfilePhoto: false },
    step5: { referralSource: ['지인 소개'], budgetRange: '300만원 ~ 500만원', marketingGoals: ['신규 환자 유입'], desiredChannels: ['네이버 블로그'] },
    stepWeb: { subway: '강남역 1번 출구', desiredDomain: 'e2etest.com', ssl: '있음(보유 중)', features: ['온라인 예약'], renewalType: '신규 제작', homepageDeadline: '2026년 11월', maintenance: '희망함', menuStructure: ['병원 소개', '의료진 소개'], photoTypes: ['원장 프로필', '시술 전후'], reviewer: '실장 김OO', feedbackChannel: '카카오톡' },
    stepDesign: { logoType: '심볼+워드마크 결합형', logoNotation: '한글+영문 병기', englishSpelling: 'E2E Dental', logoMotif: '이니셜', avoidColor: '빨강', videoMessage: '따뜻한 진료', videoChannels: ['홈페이지(16:9)'], videoItems: ['드론(외부/주변)', '의료진 1분 인트로'], videoBgm: '라이선스 음원' },
    step6: { services: [], isStarterPackage: false, specialNotes: 'E2E 테스트' },
  };

  it('제출 시 거래처명 properties + 신규 섹션 본문이 노션 API 페이로드에 포함된다', async () => {
    mockCreate.mockResolvedValue({ id: 'page-e2e' });
    const id = await createMainRecord(e2ePayload);
    expect(id).toBe('page-e2e');

    const arg = mockCreate.mock.calls[0][0] as {
      properties: Record<string, { title?: Array<{ text: { content: string } }>; multi_select?: Array<{ name: string }> }>;
      children: Array<Record<string, unknown>>;
    };

    // 핵심 properties
    expect(arg.properties['거래처명'].title?.[0].text.content).toBe('E2E_테스트치과');

    // 계약 서비스(팀): 작업 범위(scope) → 팀 매핑이 속성에 반영 (스키마 무변경, 노션 표 필터용)
    const teams = (arg.properties['계약 서비스'].multi_select || []).map((t) => t.name);
    expect(teams).toEqual(expect.arrayContaining(['마케팅팀', '웹팀', '디자인팀']));
    expect(teams).not.toContain('바이럴팀');

    const body = bodyText(arg.children);

    // 진료 — 공휴일 휴진 여부 (이전엔 노션에 누락되던 필드)
    expect(body).toContain('공휴일: 휴진');

    // 진료 — 직접 입력 과목 + 투명교정 직접 입력
    expect(body).toContain('직접 입력 과목: 코골이 치료');
    expect(body).toContain('투명교정: 인비절라인, 기타, 클리어라인');

    // 시설·장비 — 장비 상세 직접 입력
    expect(body).toContain('장비 상세: 바텍 그린스마트 CT');

    // 브랜딩 신규 필드
    expect(body).toContain('슬로건: E2E 슬로건');

    // 벤치마킹·참고 사이트 — 마케팅 → 브랜딩으로 이동
    expect(body).toContain('벤치마킹·참고 사이트: 트리움치과 / example.com');
    expect(body).toContain('브랜드 비전: E2E 비전');
    expect(body).toContain('브랜드 톤앤매너: 따뜻·전문');

    // 컬러는 Step4(브랜딩)에 통합 — 디자인의 옛 colorPreference 대신 브랜드 컬러 계열로
    expect(body).toContain('브랜드 컬러 계열: 블루(신뢰·전문)');
    expect(body).not.toContain('선호 컬러:');

    // 홈페이지/웹 섹션 + 웹퍼블 신규 항목
    expect(body).toContain('홈페이지/웹');
    expect(body).toContain('도메인: e2etest.com');
    expect(body).toContain('SSL: 있음(보유 중)');
    expect(body).toContain('원하는 메뉴: 병원 소개, 의료진 소개');
    expect(body).toContain('제공 사진 종류: 원장 프로필, 시술 전후');
    expect(body).toContain('내부 검수 담당자: 실장 김OO');

    // 디자인/브랜딩 섹션
    expect(body).toContain('디자인/브랜딩');
    expect(body).toContain('로고 타입: 심볼+워드마크 결합형');
    expect(body).toContain('영상 제작 항목: 드론(외부/주변), 의료진 1분 인트로');
    expect(body).toContain('영상 BGM: 라이선스 음원');
  });

  it('신규 스텝 데이터가 없으면 해당 섹션 헤딩이 본문에 없다 (구버전 호환)', async () => {
    mockCreate.mockResolvedValue({ id: 'page-min' });
    await createMainRecord(sampleFormData); // stepWeb·stepDesign 없음
    const arg = mockCreate.mock.calls[0][0] as { children: Array<Record<string, unknown>> };
    const body = bodyText(arg.children);
    expect(body).not.toContain('디자인/브랜딩');
    expect(body).not.toContain('홈페이지/웹');
  });
});

describe('getPageData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('페이지 조회 성공', async () => {
    mockRetrieve.mockResolvedValue({ id: 'page-1', properties: {} });
    const data = await getPageData('page-1');
    expect(data).toBeTruthy();
  });

  it('없는 페이지 → null', async () => {
    mockRetrieve.mockRejectedValue(new Error('Not found'));
    const data = await getPageData('nonexistent');
    expect(data).toBeNull();
  });
});
