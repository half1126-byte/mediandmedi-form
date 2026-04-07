import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCreate, mockRetrieve } = vi.hoisted(() => {
  return {
    mockCreate: vi.fn(),
    mockRetrieve: vi.fn(),
  };
});

vi.mock('@notionhq/client', () => {
  return {
    Client: class MockClient {
      pages = {
        create: mockCreate,
        retrieve: mockRetrieve,
      };
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
  });

  it('성공 시 페이지 ID 반환', async () => {
    mockCreate.mockResolvedValue({ id: 'page-123' });
    const id = await createMainRecord(sampleFormData);
    expect(id).toBe('page-123');
    expect(mockCreate).toHaveBeenCalledTimes(1);
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
