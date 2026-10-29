type OperationsSchedule = { schedule?: Record<string, { enabled?: boolean; start?: string; end?: string }>; holidayClose?: boolean };
type OperationsFacilities = { equipment?: string[]; facilities?: string[]; parking?: { available?: string }; hasLabRoom?: boolean; labRoomAnswered?: boolean };
export function operationsComplete(schedule: OperationsSchedule | undefined, facilities: OperationsFacilities | undefined): boolean {
  if (!schedule || !facilities) return false;
  const days = ['월', '화', '수', '목', '금', '토', '일', ...(!schedule.holidayClose ? ['공휴일'] : [])];
  const times = days.map((day) => schedule.schedule?.[day]);
  const validTime = (time: unknown): time is string => typeof time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
  const validChoices = (values: unknown) => Array.isArray(values) && values.length > 0 && values.every((value) => typeof value === 'string' && value.trim()) && (!values.includes('없음') || values.length === 1);
  return times.some((time) => time?.enabled === true) && times.every((time) => time && typeof time.enabled === 'boolean' && (!time.enabled || (validTime(time.start) && validTime(time.end) && time.start < time.end)))
    && validChoices(facilities.equipment) && !facilities.equipment?.includes('없음') && validChoices(facilities.facilities)
    && ['가능', '불가', '발렛'].includes(facilities.parking?.available || '')
    && facilities.labRoomAnswered === true && typeof facilities.hasLabRoom === 'boolean';
}
