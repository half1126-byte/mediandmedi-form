import { it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('@/lib/notion', () => ({ createMainRecord: vi.fn().mockResolvedValue('saved-client'), ensureOpeningSetup: vi.fn().mockRejectedValue(new Error('object_not_found')) }));
import { POST } from '@/app/api/submit/route';
import { createMainRecord, ensureOpeningSetup } from '@/lib/notion';
afterEach(() => vi.unstubAllEnvs());
it('preserves a successful client save and reports failed task setup separately', async () => {
  vi.stubEnv('NOTION_MEETING_API_KEY', 'mock-key');
  vi.stubEnv('NOTION_MAIN_DB_ID', 'mock-db');
  const response = await POST(new NextRequest('http://localhost:3000/api/submit', { method: 'POST', body: JSON.stringify({
    step1: { clinicName: '테스트', phone: '02-1234-5678', address: '서울' },
    step2: { holidayClose: true, schedule: Object.fromEntries(['월','화','수','목','금','토','일'].map(day => [day, { enabled: true, start: '09:00', end: '18:00' }])) },
    step3: { equipment: ['치과용 CT'], facilities: ['없음'], parking: { available: '불가' }, hasLabRoom: false, labRoomAnswered: true },
    step4: { education: '학력', career: '경력', brandTone: '신뢰감', brandColorTones: ['블루'] }
  }) }));
  const result = await response.json();
  expect(response.status).toBe(200);
  expect(result.success).toBe(true);
  expect(result.pageId).toBe('saved-client');
  expect(result.warning).toContain('자동 생성이 완료되지 않았습니다');
  expect(createMainRecord).toHaveBeenCalledTimes(1);
  expect(ensureOpeningSetup).toHaveBeenCalledWith('saved-client');
});
