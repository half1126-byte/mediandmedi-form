'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { isHoliday } from '@/data/holidays';

// 날짜별 일정 타입
type ScheduleTag = '휴진' | '토요일진료' | '일요일진료' | '오전진료' | '오후진료' | '야간진료' | '공휴일진료';

type ActiveMode = ScheduleTag | 'ERASE' | null;

const SCHEDULE_TAGS: { label: ScheduleTag; color: string; bg: string }[] = [
  { label: '휴진', color: '#DC2626', bg: '#FEE2E2' },
  { label: '토요일진료', color: '#2563EB', bg: '#DBEAFE' },
  { label: '일요일진료', color: '#7C3AED', bg: '#EDE9FE' },
  { label: '오전진료', color: '#059669', bg: '#D1FAE5' },
  { label: '오후진료', color: '#D97706', bg: '#FEF3C7' },
  { label: '야간진료', color: '#1E3A5F', bg: '#E0E7FF' },
  { label: '공휴일진료', color: '#BE185D', bg: '#FCE7F3' },
];

const PRINT_SIZES = [
  '팝업(가로)', '팝업(세로)', 'A4(가로)', 'A4(세로)', '세로형 DID', '가로형 DID',
] as const;

function formatDate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay(); // 0=일, 1=월...
}

export default function ScheduleChangePage() {
  const router = useRouter();

  // 안내 팝업
  const [showGuide, setShowGuide] = useState(true);

  // 폼 상태
  const [clinicName, setClinicName] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [clinicOptions, setClinicOptions] = useState<string[]>([]);
  const [showClinicDropdown, setShowClinicDropdown] = useState(false);
  const clinicInputRef = useRef<HTMLDivElement>(null);

  // 거래처명 옵션 로드
  useEffect(() => {
    fetch('/api/clinic-names')
      .then((r) => r.json())
      .then((d) => {
        if (d.clinicNames) setClinicOptions(d.clinicNames);
      })
      .catch(() => {});
  }, []);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (clinicInputRef.current && !clinicInputRef.current.contains(e.target as Node)) {
        setShowClinicDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredClinics = clinicOptions.filter(
    (name) => name.toLowerCase().includes(clinicName.toLowerCase()) && name !== clinicName
  );

  // 달력 상태
  const now = new Date();
  const nextMonth = now.getMonth() + 2 > 12
    ? { year: now.getFullYear() + 1, month: 1 }
    : { year: now.getFullYear(), month: now.getMonth() + 2 };
  const [calYear, setCalYear] = useState(nextMonth.year);
  const [calMonth, setCalMonth] = useState(nextMonth.month);
  const [dateSchedules, setDateSchedules] = useState<Record<string, ScheduleTag[]>>({});

  // 모드 상태
  const [activeMode, setActiveMode] = useState<ActiveMode>(null);
  const [showModeHint, setShowModeHint] = useState(false);

  // 이벤트, 사이즈, 요청
  const [events, setEvents] = useState('');
  const [printSizes, setPrintSizes] = useState<string[]>([]);
  const [extraRequest, setExtraRequest] = useState('');
  const [holidayReason, setHolidayReason] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  // 달력 데이터 계산
  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDay = getFirstDayOfWeek(calYear, calMonth);

  const prevMonth = () => {
    if (calMonth === 1) { setCalYear(calYear - 1); setCalMonth(12); }
    else setCalMonth(calMonth - 1);
  };
  const nextMo = () => {
    if (calMonth === 12) { setCalYear(calYear + 1); setCalMonth(1); }
    else setCalMonth(calMonth + 1);
  };

  const applyModeToDate = (dateStr: string) => {
    if (!activeMode) {
      setShowModeHint(true);
      setTimeout(() => setShowModeHint(false), 2000);
      return;
    }
    if (activeMode === 'ERASE') {
      const updated = { ...dateSchedules };
      delete updated[dateStr];
      setDateSchedules(updated);
      return;
    }
    const current = dateSchedules[dateStr] || [];
    const hasTag = current.includes(activeMode as ScheduleTag);
    setDateSchedules({
      ...dateSchedules,
      [dateStr]: hasTag
        ? current.filter(t => t !== activeMode)
        : [...current, activeMode as ScheduleTag],
    });
  };

  const togglePrintSize = (size: string) => {
    if (printSizes.includes(size)) {
      setPrintSizes(printSizes.filter((s) => s !== size));
    } else {
      setPrintSizes([...printSizes, size]);
    }
  };

  const canSubmit = clinicName.trim() && doctorName.trim();

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError('');

    // 일정 데이터를 텍스트로 정리
    const scheduleSummary = Object.entries(dateSchedules)
      .filter(([, tags]) => tags.length > 0)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, tags]) => {
        const d = parseInt(date.split('-')[2]);
        const h = isHoliday(date);
        const prefix = h ? `${d}일(${h.name})` : `${d}일`;
        return `${prefix}: ${tags.join(', ')}`;
      })
      .join('\n');

    try {
      const res = await fetch('/api/schedule-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicName: clinicName.trim(),
          doctorName: doctorName.trim(),
          targetMonth: `${calYear}년 ${calMonth}월`,
          calYear,
          calMonth,
          scheduleData: scheduleSummary,
          dateSchedulesRaw: dateSchedules,
          events: events.trim(),
          printSizes,
          extraRequest: extraRequest.trim(),
          holidayReason: holidayReason.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setDone(true);
      } else {
        setError(data.error || '저장 실패');
      }
    } catch {
      setError('네트워크 연결을 확인해 주세요');
    } finally {
      setSubmitting(false);
    }
  };

  // 안내 팝업
  if (showGuide) {
    return (
      <div className="min-h-screen bg-black/50 flex items-center justify-center px-6 fixed inset-0 z-50">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 animate-fade-in">
          <div className="text-center mb-5">
            <span className="text-4xl">📋</span>
            <h2 className="text-lg font-bold text-[#374151] mt-3">이용 안내</h2>
            <p className="text-sm text-[#6B7280] mt-1">진료일정 입력 전 확인해 주세요</p>
          </div>
          <div className="bg-[#F8FAFC] rounded-xl p-4 space-y-4 text-sm text-[#374151]">
            <div className="space-y-1">
              <p className="font-semibold text-[#1E3A5F]">📅 제출 기한</p>
              <p>
                진료일정은 매월 8일까지 전달해 주셔야 정상 제작이 가능합니다
              </p>
            </div>
            <hr className="border-[#E5E7EB]" />
            <div className="space-y-1">
              <p className="font-semibold text-[#1E3A5F]">💬 문의/수정</p>
              <p>
                문의 또는 수정사항이 있으시면 카카오톡으로 편하게 말씀해 주세요
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowGuide(false)}
            className="w-full h-12 mt-5 bg-[#2563EB] text-white rounded-lg font-semibold
                       hover:bg-[#1d4ed8] active:scale-[0.98] transition-all"
          >
            확인했습니다
          </button>
        </div>
      </div>
    );
  }

  // 완료 화면
  if (done) {
    const taggedDates = Object.entries(dateSchedules)
      .filter(([, tags]) => tags.length > 0)
      .sort(([a], [b]) => a.localeCompare(b));

    return (
      <div className="min-h-screen bg-[#F8FAFC]">
        <header className="bg-white border-b border-[#E5E7EB]">
          <div className="max-w-5xl mx-auto flex items-center justify-between px-6 py-4">
            <button onClick={() => router.push('/')} className="w-10 h-10 flex items-center justify-center">
              <svg className="w-5 h-5 text-[#374151]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-base font-semibold text-[#374151]">제출 완료</h2>
            <div className="w-10" />
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-6 py-6 space-y-6">
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-[#16A34A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-[#374151] mb-1">
              {clinicName} 진료일정 변경 접수
            </h2>
            <p className="text-sm text-[#6B7280]">{calYear}년 {calMonth}월 일정이 정상적으로 접수되었습니다</p>
          </div>

          {taggedDates.length > 0 && (
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 space-y-2">
              <h3 className="text-sm font-semibold text-[#374151]">변경 일정</h3>
              {taggedDates.map(([date, tags]) => {
                const d = parseInt(date.split('-')[2]);
                return (
                  <div key={date} className="flex items-center gap-2 text-sm">
                    <span className="text-[#6B7280] w-10">{d}일</span>
                    <div className="flex flex-wrap gap-1">
                      {tags.map((tag) => {
                        const t = SCHEDULE_TAGS.find((s) => s.label === tag);
                        return (
                          <span key={tag} className="px-2 py-0.5 rounded text-xs font-medium" style={{ color: t?.color, backgroundColor: t?.bg }}>
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

          {printSizes.length > 0 && (
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
              <h3 className="text-sm font-semibold text-[#374151] mb-1">출력 사이즈</h3>
              <p className="text-sm text-[#374151]">{printSizes.join(', ')}</p>
            </div>
          )}

          <button
            onClick={() => router.push('/')}
            className="w-full h-12 bg-[#2563EB] text-white rounded-lg font-semibold
                       hover:bg-[#1d4ed8] active:scale-[0.98] transition-all"
          >
            처음으로 돌아가기
          </button>
        </main>
      </div>
    );
  }

  // 메인 폼
  const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* 모드 힌트 토스트 */}
      {showModeHint && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-[#1E3A5F] text-white text-sm px-4 py-2 rounded-full shadow-lg z-50">
          먼저 위에서 태그를 선택해 주세요
        </div>
      )}

      <header className="bg-white border-b border-[#E5E7EB] sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-6 py-4">
          <button onClick={() => router.push('/')} className="w-10 h-10 flex items-center justify-center">
            <svg className="w-5 h-5 text-[#374151]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-base font-semibold text-[#374151]">진료일정 변경</h2>
          <div className="w-10" />
        </div>
      </header>

      <main className="max-w-5xl mx-auto w-full px-4 py-6 pb-28 lg:pb-6
                       lg:grid lg:grid-cols-[1fr_400px] lg:gap-8">

        {/* 좌측: 거래처 정보 + 태그 바 + 달력 */}
        <div className="space-y-6">

          {/* 거래처 정보 섹션 */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-[#6B7280]">거래처 정보</h3>
            <div className="flex gap-3">
              <div className="flex-1 relative" ref={clinicInputRef}>
                <input
                  type="text"
                  value={clinicName}
                  onChange={(e) => {
                    setClinicName(e.target.value);
                    setShowClinicDropdown(true);
                  }}
                  onFocus={() => setShowClinicDropdown(true)}
                  placeholder="치과명을 입력해 주세요"
                  className="w-full h-12 px-4 rounded-lg border border-[#D1D5DB] text-base
                             focus:outline-none focus:border-[#2563EB] transition-colors"
                />
                {showClinicDropdown && filteredClinics.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#D1D5DB] rounded-lg shadow-lg z-20 max-h-40 overflow-y-auto">
                    {filteredClinics.map((name) => (
                      <button
                        key={name}
                        onClick={() => {
                          setClinicName(name);
                          setShowClinicDropdown(false);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-[#F0F7FF] transition-colors"
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <input
                  type="text"
                  value={doctorName}
                  onChange={(e) => setDoctorName(e.target.value)}
                  placeholder="성함 *"
                  className="w-full h-12 px-4 rounded-lg border border-[#D1D5DB] text-base
                             focus:outline-none focus:border-[#2563EB] transition-colors"
                />
              </div>
            </div>
          </section>

          {/* 달력 + 태그 바 */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-[#6B7280]">월별 진료일정</h3>

            {/* 태그 선택 바 */}
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
              <p className="text-xs text-[#6B7280] mb-3">태그를 먼저 선택하신 후 날짜를 눌러 주세요</p>
              <div className="flex flex-wrap gap-2">
                {SCHEDULE_TAGS.map((tag) => {
                  const isActive = activeMode === tag.label;
                  return (
                    <button
                      key={tag.label}
                      onClick={() => setActiveMode(isActive ? null : tag.label as ScheduleTag)}
                      className={`px-3 py-2 rounded-full text-sm font-semibold transition-all
                        ${isActive ? 'scale-105 shadow-md' : 'opacity-70 hover:opacity-100'}
                      `}
                      style={{
                        color: isActive ? '#fff' : tag.color,
                        backgroundColor: isActive ? tag.color : tag.bg,
                        border: isActive ? `2px solid ${tag.color}` : '2px solid transparent',
                      }}
                    >
                      {tag.label}
                    </button>
                  );
                })}
                {/* 지우개 모드 */}
                <button
                  onClick={() => setActiveMode(activeMode === 'ERASE' ? null : 'ERASE')}
                  className={`px-3 py-2 rounded-full text-sm font-semibold transition-all
                    ${activeMode === 'ERASE'
                      ? 'bg-[#374151] text-white scale-105 shadow-md border-2 border-[#374151]'
                      : 'bg-[#F3F4F6] text-[#374151] opacity-70 hover:opacity-100 border-2 border-transparent'}
                  `}
                >
                  🧹 지우개
                </button>
              </div>
              {activeMode && (
                <p className="text-xs mt-3 font-medium"
                  style={{ color: activeMode === 'ERASE' ? '#374151' : SCHEDULE_TAGS.find(t => t.label === activeMode)?.color }}>
                  {activeMode === 'ERASE'
                    ? '날짜를 탭하시면 해당 날짜의 태그가 모두 지워집니다'
                    : `"${activeMode}" 모드 — 날짜를 탭해 주세요`}
                </p>
              )}
            </div>

            {/* 달력 */}
            <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
              {/* 월 네비게이션 */}
              <div className="flex items-center justify-between px-4 py-3 bg-[#1E3A5F]">
                <button onClick={prevMonth} className="w-10 h-10 flex items-center justify-center text-white">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h4 className="text-lg font-bold text-white">{calYear}년 {calMonth}월</h4>
                <button onClick={nextMo} className="w-10 h-10 flex items-center justify-center text-white">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* 요일 헤더 */}
              <div className="grid grid-cols-7 border-b border-[#E5E7EB]">
                {WEEKDAY_LABELS.map((d, i) => (
                  <div
                    key={d}
                    className={`text-center py-2 text-xs font-semibold ${
                      i === 0 ? 'text-[#DC2626]' : i === 6 ? 'text-[#2563EB]' : 'text-[#6B7280]'
                    }`}
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* 날짜 그리드 */}
              <div className="grid grid-cols-7">
                {/* 빈 칸 */}
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-20 border-b border-r border-[#F3F4F6]" />
                ))}

                {/* 날짜 셀 */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const dateStr = formatDate(calYear, calMonth, day);
                  const dayOfWeek = (firstDay + i) % 7;
                  const hol = isHoliday(dateStr);
                  const tags = dateSchedules[dateStr] || [];
                  const isSun = dayOfWeek === 0;
                  const isSat = dayOfWeek === 6;

                  // 배경색: 첫 번째 태그의 bg 또는 기본
                  const primaryTag = tags[0] ? SCHEDULE_TAGS.find(s => s.label === tags[0]) : null;

                  return (
                    <button
                      key={day}
                      onClick={() => applyModeToDate(dateStr)}
                      className={`h-20 border-b border-r border-[#F3F4F6] flex flex-col items-center pt-1.5 pb-1
                        transition-colors relative
                        ${activeMode === 'ERASE' && tags.length > 0
                          ? 'hover:bg-red-50 hover:ring-2 hover:ring-inset hover:ring-red-300'
                          : activeMode
                          ? 'hover:bg-blue-50 cursor-pointer'
                          : 'cursor-default'}
                      `}
                      style={primaryTag ? { backgroundColor: primaryTag.bg + '80' } : {}}
                    >
                      {/* 날짜 숫자 */}
                      <span className={`text-xs font-semibold leading-none ${
                        hol || isSun ? 'text-[#DC2626]' : isSat ? 'text-[#2563EB]' : 'text-[#374151]'
                      }`}>
                        {day}
                      </span>
                      {/* 공휴일명 */}
                      {hol && (
                        <span className="text-[8px] text-[#DC2626] leading-none mt-0.5 truncate max-w-full px-0.5">
                          {hol.name.length > 4 ? hol.name.substring(0, 4) : hol.name}
                        </span>
                      )}
                      {/* 태그 원형 뱃지 */}
                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-0.5 mt-auto justify-center mb-1 px-0.5">
                          {tags.slice(0, 3).map((tag) => {
                            const t = SCHEDULE_TAGS.find(s => s.label === tag);
                            const abbr = tag === '휴진' ? '휴' : tag === '토요일진료' ? '토' : tag === '일요일진료' ? '일'
                              : tag === '오전진료' ? '전' : tag === '오후진료' ? '후' : tag === '야간진료' ? '야' : '공';
                            return (
                              <span key={tag}
                                className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0"
                                style={{ backgroundColor: t?.color }}
                              >
                                {abbr}
                              </span>
                            );
                          })}
                          {tags.length > 3 && <span className="text-[7px] text-[#9CA3AF]">+{tags.length - 3}</span>}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 범례 */}
            <div className="flex flex-wrap gap-2 px-1">
              {SCHEDULE_TAGS.map((tag) => (
                <div key={tag.label} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />
                  <span className="text-[10px] text-[#9CA3AF]">{tag.label}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* 우측: 이벤트 + 출력 + 기타 + PC 제출 버튼 */}
        <div className="space-y-6 mt-6 lg:mt-0 lg:sticky lg:top-20 lg:self-start">

          {/* 휴진 사유 - 휴진 날짜가 있을 때만 표시 */}
          {Object.values(dateSchedules).some((tags) => tags.includes('휴진')) && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-[#6B7280]">
                <span className="inline-block w-2 h-2 rounded-full bg-[#DC2626] mr-1.5 align-middle" />
                휴진 사유
              </h3>
              <input
                type="text"
                value={holidayReason}
                onChange={(e) => setHolidayReason(e.target.value)}
                placeholder="예: 원장 개인 사정, 건물 공사, 학회 참석"
                className="w-full h-11 px-4 rounded-lg border border-[#D1D5DB] text-sm
                           focus:outline-none focus:border-[#DC2626] transition-colors"
              />
            </section>
          )}

          {/* 이벤트 */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-[#6B7280]">다음 달 이벤트를 알려 주세요</h3>
            <textarea
              value={events}
              onChange={(e) => setEvents(e.target.value)}
              placeholder={`다음 달 이벤트 내용을 알려 주세요\n예: 5/1~5/15 화이트닝 이벤트 30% 할인`}
              rows={3}
              className="w-full px-4 py-3 rounded-lg border border-[#D1D5DB] text-sm resize-none
                         focus:outline-none focus:border-[#2563EB] transition-colors"
            />
          </section>

          {/* 출력 사이즈 */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-[#6B7280]">출력 사이즈를 선택해 주세요</h3>
            <div className="grid grid-cols-2 gap-2">
              {PRINT_SIZES.map((size) => {
                const active = printSizes.includes(size);
                return (
                  <button
                    key={size}
                    onClick={() => togglePrintSize(size)}
                    className={`h-11 rounded-lg text-sm font-medium transition-all
                      ${active
                        ? 'bg-[#2563EB] text-white shadow-sm'
                        : 'bg-white text-[#374151] border border-[#D1D5DB] hover:border-[#2563EB] hover:text-[#2563EB]'
                      }
                    `}
                  >
                    {size}
                  </button>
                );
              })}
            </div>
          </section>

          {/* 기타 요청사항 */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-[#6B7280]">추가 요청사항</h3>
            <textarea
              value={extraRequest}
              onChange={(e) => setExtraRequest(e.target.value)}
              placeholder="추가로 요청하실 내용이 있으시면 자유롭게 적어 주세요"
              rows={3}
              className="w-full px-4 py-3 rounded-lg border border-[#D1D5DB] text-sm resize-none
                         focus:outline-none focus:border-[#2563EB] transition-colors"
            />
          </section>

          {error && <p className="text-sm text-[#DC2626] text-center">{error}</p>}

          {/* PC 전용 제출 버튼 */}
          <button
            className="hidden lg:block w-full h-12 bg-[#2563EB] text-white rounded-lg font-semibold
                       hover:bg-[#1d4ed8] active:scale-[0.98] transition-all
                       disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
          >
            {submitting ? '제출 중입니다...' : '진료일정 제출하기'}
          </button>
        </div>
      </main>

      {/* 모바일 전용 하단 고정 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] px-6 py-4 lg:hidden">
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className="w-full h-12 bg-[#2563EB] text-white rounded-lg font-semibold
                     disabled:opacity-50 disabled:cursor-not-allowed
                     hover:bg-[#1d4ed8] active:scale-[0.98] transition-all"
        >
          {submitting ? '제출 중입니다...' : '진료일정 제출하기'}
        </button>
      </div>
    </div>
  );
}
