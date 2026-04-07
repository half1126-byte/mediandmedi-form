// 대한민국 공휴일 데이터 (2026-2027)
// 음력 기반 공휴일은 연도별로 직접 매핑

export interface Holiday {
  date: string; // YYYY-MM-DD
  name: string;
  type: 'public' | 'substitute'; // 공휴일 / 대체공휴일
}

const HOLIDAYS_2026: Holiday[] = [
  { date: '2026-01-01', name: '신정', type: 'public' },
  { date: '2026-02-16', name: '설날 연휴', type: 'public' },
  { date: '2026-02-17', name: '설날', type: 'public' },
  { date: '2026-02-18', name: '설날 연휴', type: 'public' },
  { date: '2026-03-01', name: '삼일절', type: 'public' },
  { date: '2026-05-05', name: '어린이날', type: 'public' },
  { date: '2026-05-24', name: '부처님오신날', type: 'public' },
  { date: '2026-05-25', name: '대체공휴일', type: 'substitute' },
  { date: '2026-06-06', name: '현충일', type: 'public' },
  { date: '2026-08-15', name: '광복절', type: 'public' },
  { date: '2026-09-24', name: '추석 연휴', type: 'public' },
  { date: '2026-09-25', name: '추석', type: 'public' },
  { date: '2026-09-26', name: '추석 연휴', type: 'public' },
  { date: '2026-10-03', name: '개천절', type: 'public' },
  { date: '2026-10-09', name: '한글날', type: 'public' },
  { date: '2026-12-25', name: '크리스마스', type: 'public' },
];

const HOLIDAYS_2027: Holiday[] = [
  { date: '2027-01-01', name: '신정', type: 'public' },
  { date: '2027-02-06', name: '설날 연휴', type: 'public' },
  { date: '2027-02-07', name: '설날', type: 'public' },
  { date: '2027-02-08', name: '설날 연휴', type: 'public' },
  { date: '2027-03-01', name: '삼일절', type: 'public' },
  { date: '2027-05-05', name: '어린이날', type: 'public' },
  { date: '2027-05-13', name: '부처님오신날', type: 'public' },
  { date: '2027-06-06', name: '현충일', type: 'public' },
  { date: '2027-08-15', name: '광복절', type: 'public' },
  { date: '2027-09-14', name: '추석 연휴', type: 'public' },
  { date: '2027-09-15', name: '추석', type: 'public' },
  { date: '2027-09-16', name: '추석 연휴', type: 'public' },
  { date: '2027-10-03', name: '개천절', type: 'public' },
  { date: '2027-10-09', name: '한글날', type: 'public' },
  { date: '2027-10-11', name: '대체공휴일', type: 'substitute' },
  { date: '2027-12-25', name: '크리스마스', type: 'public' },
];

const ALL_HOLIDAYS: Record<number, Holiday[]> = {
  2026: HOLIDAYS_2026,
  2027: HOLIDAYS_2027,
};

export function getHolidaysForMonth(year: number, month: number): Holiday[] {
  const holidays = ALL_HOLIDAYS[year] || [];
  const mm = String(month).padStart(2, '0');
  const prefix = `${year}-${mm}`;
  return holidays.filter((h) => h.date.startsWith(prefix));
}

export function isHoliday(dateStr: string): Holiday | undefined {
  const year = parseInt(dateStr.substring(0, 4));
  const holidays = ALL_HOLIDAYS[year] || [];
  return holidays.find((h) => h.date === dateStr);
}
