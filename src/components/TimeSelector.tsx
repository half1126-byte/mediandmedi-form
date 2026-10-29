'use client';

import { WEEKDAYS } from '@/data/dental';

interface DaySchedule {
  enabled: boolean;
  start: string;
  end: string;
  night?: boolean;
}

interface TimeSelectorProps {
  schedule: Record<string, DaySchedule>;
  onChange: (schedule: Record<string, DaySchedule>) => void;
  showNight?: boolean;
  includeHoliday?: boolean;
}

const TIME_OPTIONS: string[] = [];
for (let h = 7; h <= 22; h++) {
  for (const m of ['00', '30']) {
    TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:${m}`);
  }
}

export default function TimeSelector({ schedule, onChange, showNight = false, includeHoliday = false }: TimeSelectorProps) {
  const updateDay = (day: string, updates: Partial<DaySchedule>) => {
    onChange({
      ...schedule,
      [day]: { ...schedule[day], ...updates },
    });
  };

  return (
    <div className="space-y-2">
      {(includeHoliday ? [...WEEKDAYS, '공휴일'] : WEEKDAYS).map((day) => {
        const daySchedule = schedule[day] || {
          enabled: day !== '일',
          start: '09:00',
          end: '18:00',
        };

        return (
          <div
            key={day}
            className="flex items-center gap-3 p-3 rounded-lg bg-white border border-[#E5E7EB]"
          >
            <button
              type="button"
              onClick={() => updateDay(day, { enabled: !daySchedule.enabled, ...(!daySchedule.enabled ? {} : { night: false }) })}
              className={`
                w-10 h-10 rounded-full text-sm font-semibold flex-shrink-0
                transition-all duration-150 min-w-[44px] min-h-[44px]
                flex items-center justify-center
                ${
                  daySchedule.enabled
                    ? 'bg-[#2563EB] text-white'
                    : 'bg-gray-100 text-[#9CA3AF] border border-[#D1D5DB]'
                }
              `}
            >
              <span className={day === '공휴일' ? 'text-[10px] whitespace-nowrap' : ''}>{day}</span>
            </button>
            {daySchedule.enabled ? (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <select
                  aria-label={`${day} 진료 시작 시간`}
                  value={daySchedule.start}
                  onChange={(e) => updateDay(day, { start: e.target.value })}
                  className="flex-1 h-10 px-2 rounded border border-[#D1D5DB] text-sm text-[#374151] bg-white min-w-0"
                >
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <span className="text-[#9CA3AF] text-sm flex-shrink-0">~</span>
                <select
                  aria-label={`${day} 진료 종료 시간`}
                  value={daySchedule.end}
                  onChange={(e) => updateDay(day, { end: e.target.value })}
                  className="flex-1 h-10 px-2 rounded border border-[#D1D5DB] text-sm text-[#374151] bg-white min-w-0"
                >
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                {showNight && <button type="button" aria-label={`${day}요일 야간진료`} aria-pressed={!!daySchedule.night}
                  onClick={() => updateDay(day, { night: !daySchedule.night })}
                  className={`flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg border text-[10px] ${daySchedule.night ? 'border-yellow-400 bg-yellow-300 text-yellow-900' : 'border-gray-200 text-gray-400'}`}>
                  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z" /></svg>
                  야간
                </button>}
              </div>
            ) : (
              <span className="text-sm text-[#DC2626]">휴무</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
