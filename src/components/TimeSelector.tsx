'use client';

import { WEEKDAYS } from '@/data/dental';

interface DaySchedule {
  enabled: boolean;
  start: string;
  end: string;
}

interface TimeSelectorProps {
  schedule: Record<string, DaySchedule>;
  onChange: (schedule: Record<string, DaySchedule>) => void;
}

const TIME_OPTIONS: string[] = [];
for (let h = 7; h <= 22; h++) {
  for (const m of ['00', '30']) {
    TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:${m}`);
  }
}

export default function TimeSelector({ schedule, onChange }: TimeSelectorProps) {
  const updateDay = (day: string, updates: Partial<DaySchedule>) => {
    onChange({
      ...schedule,
      [day]: { ...schedule[day], ...updates },
    });
  };

  return (
    <div className="space-y-2">
      {WEEKDAYS.map((day) => {
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
              onClick={() => updateDay(day, { enabled: !daySchedule.enabled })}
              className={`
                w-10 h-10 rounded-full text-sm font-semibold flex-shrink-0
                transition-all duration-150 min-w-[44px] min-h-[44px]
                flex items-center justify-center
                ${
                  daySchedule.enabled
                    ? day === '토'
                      ? 'bg-blue-100 text-[#2563EB] border-2 border-[#2563EB]'
                      : day === '일'
                      ? 'bg-red-100 text-red-600 border-2 border-red-400'
                      : 'bg-[#2563EB] text-white'
                    : 'bg-gray-100 text-[#9CA3AF] border border-[#D1D5DB]'
                }
              `}
            >
              {day}
            </button>
            {daySchedule.enabled ? (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <select
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
                  value={daySchedule.end}
                  onChange={(e) => updateDay(day, { end: e.target.value })}
                  className="flex-1 h-10 px-2 rounded border border-[#D1D5DB] text-sm text-[#374151] bg-white min-w-0"
                >
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            ) : (
              <span className="text-sm text-[#9CA3AF]">휴무</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
