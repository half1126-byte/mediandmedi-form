'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getHolidaysForMonth, isHoliday } from '@/data/holidays';

// 날짜별 일정 타입
type ScheduleTag = '휴진' | '토요일진료' | '일요일진료' | '오전진료' | '오후진료' | '야간진료' | '공휴일진료';

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
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // 이벤트, 사이즈, 요청
  const [events, setEvents] = useState('');
  const [printSizes, setPrintSizes] = useState<string[]>([]);
  const [extraRequest, setExtraRequest] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  // 달력 데이터 계산
  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDay = getFirstDayOfWeek(calYear, calMonth);
  const holidays = useMemo(() => getHolidaysForMonth(calYear, calMonth), [calYear, calMonth]);

  const prevMonth = () => {
    if (calMonth === 1) { setCalYear(calYear - 1); setCalMonth(12); }
    else setCalMonth(calMonth - 1);
  };
  const nextMo = () => {
    if (calMonth === 12) { setCalYear(calYear + 1); setCalMonth(1); }
    else setCalMonth(calMonth + 1);
  };

  const toggleDateTag = (dateStr: string, tag: ScheduleTag) => {
    const current = dateSchedules[dateStr] || [];
    if (current.includes(tag)) {
      const updated = current.filter((t) => t !== tag);
      setDateSchedules({ ...dateSchedules, [dateStr]: updated });
    } else {
      setDateSchedules({ ...dateSchedules, [dateStr]: [...current, tag] });
    }
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
          scheduleData: scheduleSummary,
          events: events.trim(),
          printSizes,
          extraRequest: extraRequest.trim(),
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
                본 진료일정은<br />
                <span className="font-semibold text-[#2563EB]">매월 8일까지</span> 전달주셔야<br />
                제작이 가능합니다.
              </p>
            </div>
            <hr className="border-[#E5E7EB]" />
            <div className="space-y-1">
              <p className="font-semibold text-[#1E3A5F]">💬 문의/수정</p>
              <p>
                문의 또는 수정사항이 있으실 경우<br />
                <span className="font-semibold text-[#F59E0B]">카카오톡</span>을 통해<br />
                전해주시면 감사하겠습니다.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowGuide(false)}
            className="w-full h-12 mt-5 bg-[#2563EB] text-white rounded-lg font-semibold
                       hover:bg-[#1d4ed8] active:scale-[0.98] transition-all"
          >
            확인 후 입력하기
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
          <div className="max-w-lg mx-auto flex items-center justify-between px-6 py-4">
            <button onClick={() => router.push('/')} className="w-10 h-10 flex items-center justify-center">
              <svg className="w-5 h-5 text-[#374151]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-base font-semibold text-[#374151]">제출 완료</h2>
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
            <p className="text-sm text-[#6B7280]">{calYear}년 {calMonth}월 일정이 노션에 기록되었습니다</p>
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
            홈으로 돌아가기
          </button>
        </main>
      </div>
    );
  }

  // 메인 폼
  const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="bg-white border-b border-[#E5E7EB] sticky top-0 z-10">
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
                placeholder="거래처명 *"
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

        {/* 달력 */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-[#6B7280]">월별 진료일정</h3>
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
              {/* 빈 칸 (월 시작 전) */}
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="h-14 border-b border-r border-[#F3F4F6]" />
              ))}

              {/* 날짜들 */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateStr = formatDate(calYear, calMonth, day);
                const dayOfWeek = (firstDay + i) % 7; // 0=일
                const hol = isHoliday(dateStr);
                const tags = dateSchedules[dateStr] || [];
                const isSelected = selectedDate === dateStr;
                const isSun = dayOfWeek === 0;
                const isSat = dayOfWeek === 6;

                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                    className={`h-14 border-b border-r border-[#F3F4F6] relative flex flex-col items-center pt-1
                      transition-colors
                      ${isSelected ? 'bg-blue-50 ring-2 ring-[#2563EB] ring-inset' : 'hover:bg-gray-50'}
                    `}
                  >
                    <span className={`text-xs font-medium leading-none ${
                      hol ? 'text-[#DC2626]' : isSun ? 'text-[#DC2626]' : isSat ? 'text-[#2563EB]' : 'text-[#374151]'
                    }`}>
                      {day}
                    </span>
                    {hol && (
                      <span className="text-[8px] text-[#DC2626] leading-none mt-0.5 truncate max-w-full px-0.5">
                        {hol.name.length > 3 ? hol.name.substring(0, 3) : hol.name}
                      </span>
                    )}
                    {tags.length > 0 && (
                      <div className="flex gap-0.5 mt-auto mb-1">
                        {tags.slice(0, 3).map((tag) => {
                          const t = SCHEDULE_TAGS.find((s) => s.label === tag);
                          return <div key={tag} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: t?.color }} />;
                        })}
                        {tags.length > 3 && <span className="text-[7px] text-[#9CA3AF]">+{tags.length - 3}</span>}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 날짜 선택 시 태그 패널 */}
          {selectedDate && (() => {
            const day = parseInt(selectedDate.split('-')[2]);
            const hol = isHoliday(selectedDate);
            const tags = dateSchedules[selectedDate] || [];
            return (
              <div className="bg-white rounded-xl border border-[#2563EB] p-4 space-y-3 animate-fade-in">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-[#374151]">
                    {calMonth}월 {day}일 {hol ? `(${hol.name})` : ''}
                  </h4>
                  <button onClick={() => setSelectedDate(null)} className="text-[#9CA3AF] text-xs">닫기</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {SCHEDULE_TAGS.map((tag) => {
                    const active = tags.includes(tag.label);
                    return (
                      <button
                        key={tag.label}
                        onClick={() => toggleDateTag(selectedDate, tag.label)}
                        className={`px-3 py-2 rounded-full text-sm font-medium transition-all
                          ${active ? 'scale-105 shadow-sm' : 'opacity-60 hover:opacity-100'}
                        `}
                        style={{
                          color: active ? '#fff' : tag.color,
                          backgroundColor: active ? tag.color : tag.bg,
                          borderWidth: '1px',
                          borderColor: active ? tag.color : 'transparent',
                        }}
                      >
                        {tag.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

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

        {/* 이벤트 */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-[#6B7280]">다음달 이벤트</h3>
          <textarea
            value={events}
            onChange={(e) => setEvents(e.target.value)}
            placeholder={`예: ${calMonth}/1~${calMonth}/15 화이트닝 이벤트 30% 할인\n${calMonth}/20~${calMonth}/30 임플란트 상담 무료`}
            rows={3}
            className="w-full px-4 py-3 rounded-lg border border-[#D1D5DB] text-sm resize-none
                       focus:outline-none focus:border-[#2563EB] transition-colors"
          />
        </section>

        {/* 출력 사이즈 */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-[#6B7280]">출력 사이즈 선택</h3>
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
          <h3 className="text-sm font-semibold text-[#6B7280]">기타 요청사항</h3>
          <textarea
            value={extraRequest}
            onChange={(e) => setExtraRequest(e.target.value)}
            placeholder="추가 요청사항이 있으시면 입력해 주세요"
            rows={3}
            className="w-full px-4 py-3 rounded-lg border border-[#D1D5DB] text-sm resize-none
                       focus:outline-none focus:border-[#2563EB] transition-colors"
          />
        </section>

        {error && <p className="text-sm text-[#DC2626] text-center">{error}</p>}
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
            {submitting ? '저장 중...' : '진료일정 제출하기'}
          </button>
        </div>
      </div>
    </div>
  );
}
