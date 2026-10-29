import { describe, it, expect } from 'vitest';
import { operationsComplete } from '@/lib/operations';
const schedule = { holidayClose: true, schedule: Object.fromEntries(['월','화','수','목','금','토','일'].map(day => [day, { enabled: true, start: '09:00', end: '18:00' }])) };
const facilities = { equipment: ['치과용 CT'], facilities: ['없음'], parking: { available: '불가' }, hasLabRoom: false, labRoomAnswered: true };
describe('operations required fields', () => {
  it('accepts explicit none and no lab', () => expect(operationsComplete(schedule, facilities)).toBe(true));
  it('rejects unanswered selections', () => {
    for (const patch of [{ equipment: [] }, { facilities: [] }, { parking: { available: '' } }, { labRoomAnswered: false }, { equipment: ['없음', 'CT'] }]) expect(operationsComplete(schedule, { ...facilities, ...patch })).toBe(false);
  });
  it('rejects invalid hours and all closed', () => {
    expect(operationsComplete({ ...schedule, schedule: { ...schedule.schedule, 월: { enabled: true, start: '18:00', end: '09:00' } } }, facilities)).toBe(false);
    expect(operationsComplete({ ...schedule, schedule: Object.fromEntries(Object.entries(schedule.schedule).map(([day, time]) => [day, { ...time, enabled: false }])) }, facilities)).toBe(false);
  });
});
