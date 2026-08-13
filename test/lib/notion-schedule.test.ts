import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreate, mockSearch } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockSearch: vi.fn(),
}));

vi.mock('@notionhq/client', () => ({
  Client: class MockClient {
    pages = { create: mockCreate };
    search = mockSearch;
  },
  isNotionClientError: () => false,
}));

vi.stubEnv('NOTION_API_KEY', 'test-key');
vi.stubEnv('NOTION_SCHEDULE_DB_ID', 'schedule-db-id');

import { createScheduleChangeRecord } from '@/lib/notion';

describe('createScheduleChangeRecord schedule tag properties', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearch.mockResolvedValue({ results: [] });
    mockCreate.mockResolvedValue({ id: 'schedule-page' });
  });

  it('adds each date time to Saturday, Sunday, and night-treatment properties only', async () => {
    await createScheduleChangeRecord({
      clinicName: '테스트치과',
      doctorName: '김원장',
      dateSchedulesRaw: {
        '2026-08-05': ['토요일진료', '오전진료'],
        '2026-08-07': ['일요일진료'],
        '2026-08-17': ['야간진료'],
        '2026-08-24': ['야간진료'],
      },
      dateTimes: {
        '2026-08-05': '09:00~13:00',
        '2026-08-07': '09:00~14:00',
        '2026-08-17': '09:00~21:00',
      },
    });

    const properties = mockCreate.mock.calls[0][0].properties;
    expect(properties['토요일진료'].rich_text[0].text.content).toBe('5일 09:00~13:00');
    expect(properties['일요일진료'].rich_text[0].text.content).toBe('7일 09:00~14:00');
    expect(properties['야간진료_변경'].rich_text[0].text.content).toBe('17일 09:00~21:00, 24일');
    expect(properties['오전진료'].rich_text[0].text.content).toBe('5일');
  });
});
