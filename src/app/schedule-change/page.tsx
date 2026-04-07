'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import TimeSelector from '@/components/TimeSelector';
import { WEEKDAYS } from '@/data/dental';

const DEFAULT_SCHEDULE: Record<string, { enabled: boolean; start: string; end: string }> = {};
WEEKDAYS.forEach((day) => {
  DEFAULT_SCHEDULE[day] = {
    enabled: day !== '일',
    start: '09:00',
    end: day === '토' ? '13:00' : '18:00',
  };
});

export default function ScheduleChangePage() {
  const router = useRouter();
  const [clinicName, setClinicName] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE);
  const [lunchTime, setLunchTime] = useState({ start: '12:30', end: '13:30' });
  const [holidayClose, setHolidayClose] = useState(true);
  const [nightWeekend, setNightWeekend] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = clinicName.trim() && doctorName.trim() && reason.trim();

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/schedule-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicName: clinicName.trim(),
          doctorName: doctorName.trim(),
          schedule,
          lunchTime,
          holidayClose,
          nightWeekend: nightWeekend.trim(),
          reason: reason.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setDone(true);
      } else {
        setError(data.error || '저장 실패');
      }
    } catch {
      setError('네트워크 오류');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    const scheduleLines = Object.entries(schedule)
      .filter(([, v]) => v.enabled)
      .map(([day, v]) => `${day} ${v.start}~${v.end}`);

    return (
      <div className="min-h-screen bg-[#F8FAFC]">
        <header className="bg-white border-b border-[#E5E7EB]">
          <div className="max-w-lg mx-auto flex items-center justify-between px-6 py-4">
            <button onClick={() => router.push('/')} className="w-10 h-10 flex items-center justify-center">
              <svg className="w-5 h-5 text-[#374151]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-base font-semibold text-[#374151]">변경 완료</h2>
            <div className="w-10" />
          </div>
        </header>
        <main className="max-w-lg mx-auto px-6 py-6 space-y-6">
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-[#16A34A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-[#374151] mb-1">
              {clinicName} 진료일정 변경 접수
            </h2>
            <p className="text-sm text-[#6B7280]">노션에 기록되었습니다</p>
          </div>

          <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 space-y-2">
            <h3 className="text-sm font-semibold text-[#374151]">변경된 진료시간</h3>
            <div className="space-y-1">
              {scheduleLines.map((line) => (
                <p key={line} className="text-sm text-[#374151]">{line}</p>
              ))}
              {lunchTime.start && (
                <p className="text-sm text-[#6B7280]">점심: {lunchTime.start}~{lunchTime.end}</p>
              )}
              <p className="text-sm text-[#6B7280]">공휴일: {holidayClose ? '휴진' : '진료'}</p>
              {nightWeekend && <p className="text-sm text-[#6B7280]">특이사항: {nightWeekend}</p>}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 space-y-1">
            <h3 className="text-sm font-semibold text-[#374151]">변경 사유</h3>
            <p className="text-sm text-[#374151]">{reason}</p>
          </div>

          <button
            onClick={() => router.push('/')}
            className="w-full h-12 bg-[#2563EB] text-white rounded-lg font-semibold
                       hover:bg-[#1d4ed8] active:scale-[0.98] transition-all"
          >
            홈으로 돌아가기
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="bg-white border-b border-[#E5E7EB]">
        <div className="max-w-lg mx-auto flex items-center justify-between px-6 py-4">
          <button onClick={() => router.push('/')} className="w-10 h-10 flex items-center justify-center">
            <svg className="w-5 h-5 text-[#374151]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-base font-semibold text-[#374151]">진료일정 변경</h2>
          <div className="w-10" />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-6 py-6 space-y-6 pb-28">
        {/* 거래처 정보 */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-[#6B7280]">거래처 정보</h3>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1">
              치과명 <span className="text-[#DC2626]">*</span>
            </label>
            <input
              type="text"
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
              placeholder="예: OO치과의원"
              className="w-full h-12 px-4 rounded-lg border border-[#D1D5DB] text-base
                         focus:outline-none focus:border-[#2563EB] transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1">
              원장명 <span className="text-[#DC2626]">*</span>
            </label>
            <input
              type="text"
              value={doctorName}
              onChange={(e) => setDoctorName(e.target.value)}
              placeholder="예: 홍길동"
              className="w-full h-12 px-4 rounded-lg border border-[#D1D5DB] text-base
                         focus:outline-none focus:border-[#2563EB] transition-colors"
            />
          </div>
        </section>

        {/* 진료시간 */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-[#6B7280]">변경할 진료시간</h3>
          <TimeSelector schedule={schedule} onChange={setSchedule} />
        </section>

        {/* 점심시간 */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-[#6B7280]">점심시간</h3>
          <div className="flex items-center gap-2">
            <select
              value={lunchTime.start}
              onChange={(e) => setLunchTime({ ...lunchTime, start: e.target.value })}
              className="flex-1 h-12 px-4 rounded-lg border border-[#D1D5DB] text-base"
            >
              {['12:00', '12:30', '13:00'].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <span className="text-[#9CA3AF]">~</span>
            <select
              value={lunchTime.end}
              onChange={(e) => setLunchTime({ ...lunchTime, end: e.target.value })}
              className="flex-1 h-12 px-4 rounded-lg border border-[#D1D5DB] text-base"
            >
              {['13:00', '13:30', '14:00', '14:30'].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </section>

        {/* 공휴일 + 야간주말 */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setHolidayClose(!holidayClose)}
              className={`w-12 h-7 rounded-full transition-all flex-shrink-0 ${
                holidayClose ? 'bg-[#2563EB]' : 'bg-[#D1D5DB]'
              }`}
            >
              <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform mx-1 ${
                holidayClose ? 'translate-x-5' : ''
              }`} />
            </button>
            <span className="text-sm text-[#374151]">공휴일 휴진</span>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1">
              야간/주말 진료 특이사항
            </label>
            <input
              type="text"
              value={nightWeekend}
              onChange={(e) => setNightWeekend(e.target.value)}
              placeholder="예: 수요일 야간진료 21시까지"
              className="w-full h-12 px-4 rounded-lg border border-[#D1D5DB] text-base
                         focus:outline-none focus:border-[#2563EB] transition-colors"
            />
          </div>
        </section>

        {/* 변경 사유 */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-[#6B7280]">변경 사유</h3>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1">
              변경 사유 <span className="text-[#DC2626]">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="예: 원장님 요청으로 수요일 야간진료 추가"
              rows={3}
              className="w-full px-4 py-3 rounded-lg border border-[#D1D5DB] text-base resize-none
                         focus:outline-none focus:border-[#2563EB] transition-colors"
            />
          </div>
        </section>

        {error && (
          <p className="text-sm text-[#DC2626] text-center">{error}</p>
        )}
      </main>

      {/* 하단 고정 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] px-6 py-4">
        <div className="max-w-lg mx-auto">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="w-full h-12 bg-[#2563EB] text-white rounded-lg font-semibold
                       disabled:opacity-50 disabled:cursor-not-allowed
                       hover:bg-[#1d4ed8] active:scale-[0.98] transition-all"
          >
            {submitting ? '저장 중...' : '진료일정 변경 제출'}
          </button>
        </div>
      </div>
    </div>
  );
}
