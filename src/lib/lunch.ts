export interface LunchGroup { days: string[]; start: string; end: string; none?: boolean }
export interface LunchSettings {
  lunchGroups?: LunchGroup[];
  lunchMode?: 'same' | 'daily' | 'none';
  lunchTime: { start: string; end: string };
  lunchByDay?: Record<string, { start: string; end: string; none?: boolean }>;
  schedule: Record<string, { enabled: boolean }>;
  holidayClose: boolean;
}
export function formatLunch(data: LunchSettings): string {
  if (data.lunchMode === 'none') return '없음';
  if (data.lunchMode !== 'daily') return `${data.lunchTime.start}~${data.lunchTime.end}`;
  return Object.entries(data.schedule).filter(([day, value]) => value.enabled && (day !== '공휴일' || !data.holidayClose)).map(([day]) => {
    const lunch = data.lunchGroups ? data.lunchGroups.find((group) => group.days.includes(day)) : data.lunchByDay?.[day] || data.lunchTime;
    if (!lunch) return `${day} 미설정`;
    return `${day} ${'none' in lunch && lunch.none ? '없음' : `${lunch.start}~${lunch.end}`}`;
  }).join(' / ') || '진료일 없음';
}
