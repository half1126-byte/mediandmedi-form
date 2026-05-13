'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { isHoliday } from '@/data/holidays';

type ScheduleTag = '휴진' | '토요일진료' | '일요일진료' | '오전진료' | '오후진료' | '야간진료' | '공휴일진료';
type ActiveMode = ScheduleTag | null;

const SCHEDULE_TAGS: { label: ScheduleTag; color: string; bg: string; emoji: string }[] = [
  { label: '휴진',     color: '#DC2626', bg: '#FEE2E2', emoji: '🔴' },
  { label: '토요일진료', color: '#2563EB', bg: '#DBEAFE', emoji: '🔵' },
  { label: '일요일진료', color: '#7C3AED', bg: '#EDE9FE', emoji: '🟣' },
  { label: '오전진료',  color: '#059669', bg: '#D1FAE5', emoji: '🟢' },
  { label: '오후진료',  color: '#D97706', bg: '#FEF3C7', emoji: '🟡' },
  { label: '야간진료',  color: '#1E3A5F', bg: '#E0E7FF', emoji: '🌙' },
  { label: '공휴일진료', color: '#BE185D', bg: '#FCE7F3', emoji: '🎌' },
];

const PRINT_SIZES = ['팝업(가로)', '팝업(세로)', 'A4(가로)', 'A4(세로)', '세로형 DID', '가로형 DID'] as const;
const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function formatDate(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function getDaysInMonth(year: number, month: number) { return new Date(year, month, 0).getDate(); }
function getFirstDayOfWeek(year: number, month: number) { return new Date(year, month - 1, 1).getDay(); }

export default function ScheduleChangePage() {
  const router = useRouter();

  const [clinicName, setClinicName] = useState('');
  const [doctorName, setDoctorName] = useState('');

  const now = new Date();
  const nextMonth = now.getMonth() + 2 > 12
    ? { year: now.getFullYear() + 1, month: 1 }
    : { year: now.getFullYear(), month: now.getMonth() + 2 };
  const [calYear, setCalYear] = useState(nextMonth.year);
  const [calMonth, setCalMonth] = useState(nextMonth.month);
  const [dateSchedules, setDateSchedules] = useState<Record<string, ScheduleTag[]>>({});
  const [activeMode, setActiveMode] = useState<ActiveMode>(null);
  const [showModeHint, setShowModeHint] = useState(false);

  const [holidayReason, setHolidayReason] = useState('');
  const [events, setEvents] = useState('');
  const [printSizes, setPrintSizes] = useState<string[]>([]);
  const [extraRequest, setExtraRequest] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDay = getFirstDayOfWeek(calYear, calMonth);

  const prevMonth = () => { if (calMonth === 1) { setCalYear(calYear - 1); setCalMonth(12); } else setCalMonth(calMonth - 1); };
  const nextMo = () => { if (calMonth === 12) { setCalYear(calYear + 1); setCalMonth(1); } else setCalMonth(calMonth + 1); };

  const applyModeToDate = (dateStr: string) => {
    if (!activeMode) {
      setShowModeHint(true);
      setTimeout(() => setShowModeHint(false), 2500);
      return;
    }
    const current = dateSchedules[dateStr] || [];
    const hasTag = current.includes(activeMode as ScheduleTag);
    setDateSchedules({
      ...dateSchedules,
      [dateStr]: hasTag ? current.filter(t => t !== activeMode) : [...current, activeMode as ScheduleTag],
    });
  };

  const togglePrintSize = (size: string) =>
    setPrintSizes(prev => prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size]);

  const canSubmit = clinicName.trim() && doctorName.trim();
  const hasHoliday = Object.values(dateSchedules).some(tags => tags.includes('휴진'));

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError('');
    const scheduleSummary = Object.entries(dateSchedules)
      .filter(([, tags]) => tags.length > 0)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, tags]) => {
        const d = parseInt(date.split('-')[2]);
        const h = isHoliday(date);
        return `${h ? `${d}일(${h.name})` : `${d}일`}: ${tags.join(', ')}`;
      }).join('\n');

    try {
      const res = await fetch('/api/schedule-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicName: clinicName.trim(), doctorName: doctorName.trim(),
          targetMonth: `${calYear}년 ${calMonth}월`, calYear, calMonth,
          scheduleData: scheduleSummary, dateSchedulesRaw: dateSchedules,
          events: events.trim(), printSizes,
          extraRequest: extraRequest.trim(), holidayReason: holidayReason.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) setDone(true);
      else setError(data.error || '저장 실패');
    } catch {
      setError('네트워크 연결을 확인해 주세요');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── 완료 화면 ───────────────────────────────────────────────────────────
  if (done) {
    const taggedDates = Object.entries(dateSchedules)
      .filter(([, tags]) => tags.length > 0)
      .sort(([a], [b]) => a.localeCompare(b));

    return (
      <div className="min-h-screen bg-[#F8FAFC]">
        <header className="bg-white border-b border-[#E5E7EB]">
          <div className="max-w-4xl mx-auto flex items-center justify-between px-6 py-4">
            <button onClick={() => router.push('/')} className="w-10 h-10 flex items-center justify-center">
              <svg className="w-5 h-5 text-[#374151]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-base font-semibold text-[#374151]">제출 완료</h2>
            <div className="w-10" />
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-6 py-8 space-y-5">
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-8 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-[#16A34A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-[#374151] mb-2">제출 완료!</h2>
            <p className="text-[#6B7280]">{clinicName} · {calYear}년 {calMonth}월 진료일정이 접수되었습니다</p>
          </div>

          {taggedDates.length > 0 && (
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 space-y-2">
              <h3 className="text-sm font-semibold text-[#374151] mb-3">접수된 일정</h3>
              {taggedDates.map(([date, tags]) => {
                const d = parseInt(date.split('-')[2]);
                return (
                  <div key={date} className="flex items-center gap-3 text-sm">
                    <span className="text-[#9CA3AF] w-8 text-right">{d}일</span>
                    <div className="flex flex-wrap gap-1">
                      {tags.map(tag => {
                        const t = SCHEDULE_TAGS.find(s => s.label === tag);
                        return (
                          <span key={tag} className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                            style={{ color: t?.color, backgroundColor: t?.bg }}>
                            {tag}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <button onClick={() => router.push('/')}
            className="w-full h-13 bg-[#2563EB] text-white rounded-xl font-semibold py-3.5
                       hover:bg-[#1d4ed8] active:scale-[0.98] transition-all text-base">
            처음으로 돌아가기
          </button>
        </main>
      </div>
    );
  }

  // ─── 메인 폼 ─────────────────────────────────────────────────────────────
  const activeModeTag = activeMode
    ? SCHEDULE_TAGS.find(t => t.label === activeMode) : null;

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* 모드 미선택 토스트 */}
      {showModeHint && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50
                        bg-[#1E3A5F] text-white text-sm px-5 py-2.5 rounded-full shadow-lg
                        flex items-center gap-2 whitespace-nowrap">
          <span>👆</span> 위에서 종류를 먼저 선택해 주세요
        </div>
      )}

      {/* 헤더 */}
      <header className="bg-white border-b border-[#E5E7EB] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-6 py-4">
          <button onClick={() => router.push('/')} className="w-10 h-10 flex items-center justify-center">
            <svg className="w-5 h-5 text-[#374151]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="text-center">
            <h2 className="text-base font-semibold text-[#374151]">진료일정 변경</h2>
            <p className="text-[10px] text-[#9CA3AF]">📅 매월 8일까지 제출해 주세요</p>
          </div>
          <div className="w-10" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto w-full px-4 py-5 pb-8">
        <div className="space-y-5">

          {/* STEP 1: 치과 정보 */}
          <section className="bg-white rounded-2xl border border-[#E5E7EB] p-5 space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#2563EB] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
              <h3 className="font-semibold text-[#374151]">치과 정보를 입력해 주세요</h3>
            </div>
            <div className="space-y-3">
              {/* 치과명 */}
              <div>
                <label className="block text-xs text-[#6B7280] mb-1 font-medium">치과명</label>
                <input
                  type="text"
                  value={clinicName}
                  onChange={e => setClinicName(e.target.value)}
                  placeholder="예: OO치과의원"
                  className="w-full h-12 px-4 rounded-xl border border-[#D1D5DB] text-base
                             focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition-all"
                />
              </div>
              {/* 원장님 성함 */}
              <div>
                <label className="block text-xs text-[#6B7280] mb-1 font-medium">원장님 성함</label>
                <input
                  type="text"
                  value={doctorName}
                  onChange={e => setDoctorName(e.target.value)}
                  placeholder="예: 홍길동"
                  className="w-full h-12 px-4 rounded-xl border border-[#D1D5DB] text-base
                             focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition-all"
                />
              </div>
            </div>
          </section>

          {/* STEP 2: 진료일정 달력 */}
          <section className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
            {/* 스텝 헤더 */}
            <div className="px-5 pt-5 pb-4 border-b border-[#F3F4F6]">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-6 h-6 rounded-full bg-[#2563EB] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
                <h3 className="font-semibold text-[#374151]">달력에 일정을 표시해 주세요</h3>
              </div>
              <p className="text-sm text-[#6B7280] ml-8">① 아래에서 종류 선택 → ② 해당 날짜 탭</p>
            </div>

            {/* 태그 선택 */}
            <div className="px-5 py-4 bg-[#F8FAFC] border-b border-[#E5E7EB]">
              <div className="flex flex-wrap gap-2 mb-3">
                {SCHEDULE_TAGS.map(tag => {
                  const isActive = activeMode === tag.label;
                  return (
                    <button
                      key={tag.label}
                      onClick={() => setActiveMode(isActive ? null : tag.label as ScheduleTag)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold
                                 transition-all active:scale-95"
                      style={isActive ? {
                        backgroundColor: tag.color,
                        color: '#fff',
                        boxShadow: `0 0 0 3px ${tag.color}40, 0 2px 8px ${tag.color}50`,
                        transform: 'scale(1.05)',
                      } : {
                        backgroundColor: tag.bg,
                        color: tag.color,
                        border: `1.5px solid ${tag.color}30`,
                      }}
                    >
                      {isActive && <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                      {tag.label}
                    </button>
                  );
                })}
                {/* 전체 지우기 */}
                <button
                  onClick={() => {
                    if (Object.keys(dateSchedules).length === 0) return;
                    if (confirm('달력에 표시된 모든 일정을 초기화할까요?')) {
                      setDateSchedules({});
                      setActiveMode(null);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95
                    bg-[#F3F4F6] text-[#6B7280] border border-[#E5E7EB] hover:bg-red-50 hover:text-red-500 hover:border-red-200"
                >
                  🧹 전체 지우기
                </button>
              </div>

              {/* 활성 모드 표시줄 */}
              {activeMode && activeModeTag ? (
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-semibold"
                  style={{
                    backgroundColor: activeModeTag.bg,
                    color: activeModeTag.color,
                    border: `1.5px solid ${activeModeTag.color}40`,
                  }}>
                  <span className="text-base">{activeModeTag.emoji}</span>
                  {`${activeMode} · 이제 아래 달력에서 날짜를 탭해 주세요`}
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm text-[#9CA3AF] bg-white border border-[#E5E7EB]">
                  <span>☝️</span> 위에서 일정 종류를 먼저 선택해 주세요
                </div>
              )}
            </div>

            {/* 달력 */}
            <div>
              {/* 월 네비게이션 */}
              <div className="flex items-center justify-between px-4 py-3 bg-[#1E3A5F]">
                <button onClick={prevMonth} className="w-10 h-10 flex items-center justify-center text-white/70 hover:text-white">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h4 className="text-lg font-bold text-white">{calYear}년 {calMonth}월</h4>
                <button onClick={nextMo} className="w-10 h-10 flex items-center justify-center text-white/70 hover:text-white">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* 요일 헤더 */}
              <div className="grid grid-cols-7 bg-[#F8FAFC]">
                {WEEKDAY_LABELS.map((d, i) => (
                  <div key={d} className={`text-center py-2 text-xs font-bold
                    ${i === 0 ? 'text-[#DC2626]' : i === 6 ? 'text-[#2563EB]' : 'text-[#9CA3AF]'}`}>
                    {d}
                  </div>
                ))}
              </div>

              {/* 날짜 그리드 */}
              <div className="grid grid-cols-7">
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`e${i}`} className="h-24 border-b border-r border-[#F3F4F6]" />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const dateStr = formatDate(calYear, calMonth, day);
                  const dayOfWeek = (firstDay + i) % 7;
                  const hol = isHoliday(dateStr);
                  const tags = dateSchedules[dateStr] || [];
                  const isSun = dayOfWeek === 0;
                  const isSat = dayOfWeek === 6;
                  const primaryTag = tags[0] ? SCHEDULE_TAGS.find(s => s.label === tags[0]) : null;

                  return (
                    <button
                      key={day}
                      onClick={() => applyModeToDate(dateStr)}
                      className={`h-24 border-b border-r border-[#F3F4F6] flex flex-col items-center pt-1.5 pb-1
                        relative transition-all
                        ${activeMode
                          ? 'hover:opacity-80 cursor-pointer'
                          : 'cursor-pointer'}
                      `}
                      style={primaryTag ? { backgroundColor: primaryTag.bg + '90' } : {}}
                    >
                      <span className={`text-xs font-bold leading-none
                        ${primaryTag ? '' : hol || isSun ? 'text-[#DC2626]' : isSat ? 'text-[#2563EB]' : 'text-[#374151]'}`}
                        style={primaryTag ? { color: primaryTag.color } : {}}>
                        {day}
                      </span>
                      {hol && (
                        <span className="text-[8px] text-[#DC2626] leading-none mt-0.5 truncate max-w-full px-0.5">
                          {hol.name.length > 4 ? hol.name.slice(0, 4) : hol.name}
                        </span>
                      )}
                      {tags.length > 0 && (
                        <div className="flex flex-col gap-0.5 mt-1 w-full px-1">
                          {tags.slice(0, 3).map(tag => {
                            const t = SCHEDULE_TAGS.find(s => s.label === tag);
                            const shortLabel =
                              tag === '토요일진료' ? '토요' :
                              tag === '일요일진료' ? '일요' :
                              tag === '오전진료' ? '오전' :
                              tag === '오후진료' ? '오후' :
                              tag === '야간진료' ? '야간' :
                              tag === '공휴일진료' ? '공휴' : '휴진';
                            return (
                              <span key={tag}
                                className="w-full text-center text-[9px] font-bold leading-none py-0.5 rounded"
                                style={{ backgroundColor: t?.color, color: '#fff' }}>
                                {shortLabel}
                              </span>
                            );
                          })}
                          {tags.length > 3 && (
                            <span className="w-full text-center text-[8px] text-[#9CA3AF]">+{tags.length - 3}</span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        </div>

        {/* ── 추가 정보 (아래) ── */}
        <div className="space-y-4 mt-5">

          {/* STEP 3: 추가 정보 */}
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 space-y-5">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#2563EB] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">3</span>
              <h3 className="font-semibold text-[#374151]">추가 정보</h3>
            </div>

            {/* 휴진 사유 - 휴진 선택 시만 표시 */}
            {hasHoliday && (
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-[#DC2626]">🔴 휴진 사유</label>
                <input
                  type="text"
                  value={holidayReason}
                  onChange={e => setHolidayReason(e.target.value)}
                  placeholder="예: 원장 개인 사정, 학회 참석, 건물 공사"
                  className="w-full h-11 px-4 rounded-xl border border-[#FCA5A5] text-sm
                             focus:outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/20 transition-all"
                />
              </div>
            )}

            {/* 다음달 이벤트 */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-[#374151]">
                다음 달 이벤트 내용이 있다면 알려 주세요
              </label>
              <textarea
                value={events}
                onChange={e => setEvents(e.target.value)}
                placeholder={`예: 5/1~5/15 화이트닝 30% 할인 이벤트`}
                rows={2}
                className="w-full px-4 py-3 rounded-xl border border-[#D1D5DB] text-sm resize-none
                           focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition-all"
              />
            </div>

            {/* 출력 사이즈 */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-[#374151]">
                출력 사이즈를 선택해 주세요
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PRINT_SIZES.map(size => {
                  const active = printSizes.includes(size);
                  return (
                    <button key={size} onClick={() => togglePrintSize(size)}
                      className={`h-11 rounded-xl text-sm font-semibold transition-all
                        ${active
                          ? 'bg-[#2563EB] text-white ring-2 ring-[#2563EB] ring-offset-1'
                          : 'bg-[#F8FAFC] text-[#374151] border border-[#E5E7EB] hover:border-[#2563EB] hover:text-[#2563EB]'
                        }`}>
                      {active && '✓ '}{size}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 기타 요청사항 */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-[#374151]">
                기타 요청사항이 있으시다면 알려 주세요
              </label>
              <textarea
                value={extraRequest}
                onChange={e => setExtraRequest(e.target.value)}
                placeholder="그 외 전달하실 내용이 있으시면 자유롭게 적어 주세요"
                rows={2}
                className="w-full px-4 py-3 rounded-xl border border-[#D1D5DB] text-sm resize-none
                           focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition-all"
              />
            </div>
          </div>

          {/* 제출 안내 + 버튼 */}
          {error && <p className="text-sm text-[#DC2626] text-center px-1">{error}</p>}

          {!canSubmit && (
            <p className="text-xs text-center text-[#9CA3AF]">치과명과 원장님 성함을 입력해야 제출할 수 있습니다</p>
          )}

          {/* 제출 버튼 */}
          <button
            className="w-full py-4 bg-[#2563EB] text-white rounded-xl font-bold text-base
                       hover:bg-[#1d4ed8] active:scale-[0.98] transition-all
                       disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
          >
            {submitting ? '제출 중입니다...' : '📤 진료일정 제출하기'}
          </button>
        </div>
      </main>

    </div>
  );
}
