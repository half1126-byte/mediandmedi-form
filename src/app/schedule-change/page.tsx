'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { isHoliday } from '@/data/holidays';
import ReviewModal from '@/components/ReviewModal';

type ScheduleTag = '휴진' | '토요일진료' | '일요일진료' | '오전진료' | '오후진료' | '야간진료' | '공휴일진료';

const HOURS = Array.from({ length: 19 }, (_, i) => i + 6); // 6~24

function HourPicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const parts = value ? value.split(':') : ['', '00'];
  const selH = parts[0] ? parseInt(parts[0]) : null;
  const selM = parts[1] || '00';
  const scrollRef = useRef<HTMLDivElement>(null);
  const scroll = useCallback((dir: 1 | -1) => {
    scrollRef.current?.scrollBy({ left: dir * 120, behavior: 'smooth' });
  }, []);
  return (
    <div>
      <p className="text-[10px] font-semibold text-[#9CA3AF] mb-2 tracking-wide uppercase">{label}</p>
      <div className="flex items-center gap-1.5">
        {/* 왼쪽 화살표 */}
        <button onClick={() => scroll(-1)}
          className="shrink-0 w-8 h-10 rounded-xl bg-[#E5E7EB] text-[#6B7280] flex items-center justify-center hover:bg-[#D1D5DB] transition-all active:scale-90">
          ‹
        </button>
        <div ref={scrollRef} className="flex-1 min-w-0 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', touchAction: 'pan-x' }}>
          <div className="flex gap-1.5 pb-0.5 w-max">
            {HOURS.map(h => {
              const isOn = selH === h;
              return (
                <button key={h}
                  onClick={() => onChange(isOn ? '' : `${String(h).padStart(2, '0')}:${selM}`)}
                  className={`shrink-0 w-10 h-10 rounded-xl text-sm font-bold transition-all active:scale-90
                    ${isOn ? 'bg-[#2563EB] text-white shadow-md shadow-blue-200' : 'bg-[#F3F4F6] text-[#374151] hover:bg-[#E5E7EB]'}`}>
                  {h}
                </button>
              );
            })}
          </div>
        </div>
        {/* 오른쪽 화살표 */}
        <button onClick={() => scroll(1)}
          className="shrink-0 w-8 h-10 rounded-xl bg-[#E5E7EB] text-[#6B7280] flex items-center justify-center hover:bg-[#D1D5DB] transition-all active:scale-90">
          ›
        </button>
        <div className="flex flex-col gap-1 shrink-0">
          {['00', '30'].map(min => (
            <button key={min}
              onClick={() => { if (selH !== null) onChange(`${String(selH).padStart(2, '0')}:${min}`); }}
              className={`w-11 h-4.5 rounded-lg text-[11px] font-bold transition-all
                ${selH !== null && selM === min ? 'bg-[#2563EB] text-white' : 'bg-[#E5E7EB] text-[#9CA3AF]'}
                ${selH === null ? 'opacity-30 cursor-not-allowed' : ''}`}>
              :{min}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const SCHEDULE_TAGS: { label: ScheduleTag; color: string; bg: string; emoji: string }[] = [
  { label: '휴진',     color: '#DC2626', bg: '#FEE2E2', emoji: '🔴' },
  { label: '토요일진료', color: '#2563EB', bg: '#DBEAFE', emoji: '🔵' },
  { label: '일요일진료', color: '#7C3AED', bg: '#EDE9FE', emoji: '🟣' },
  { label: '오전진료',  color: '#059669', bg: '#D1FAE5', emoji: '🟢' },
  { label: '오후진료',  color: '#D97706', bg: '#FEF3C7', emoji: '🟡' },
  { label: '야간진료',  color: '#1E3A5F', bg: '#E0E7FF', emoji: '🌙' },
  { label: '공휴일진료', color: '#BE185D', bg: '#FCE7F3', emoji: '🎌' },
];

const PRINT_SIZES = ['팝업', 'A4', '세로 DID', '가로 DID'] as const;
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
  const [dateTimes, setDateTimes] = useState<Record<string, string>>({});

  const [designChoice, setDesignChoice] = useState<'A' | 'B' | 'C' | 'D' | 'E' | ''>('');

  const [holidayReason, setHolidayReason] = useState('');
  const [events, setEvents] = useState('');
  const [printSizes, setPrintSizes] = useState<string[]>([]);
  const [calendarText, setCalendarText] = useState('');
  const [specialNote, setSpecialNote] = useState('');
  const [extraRequest, setExtraRequest] = useState('');

  const [customLabels, setCustomLabels] = useState<Record<string, string>>({});

  // 날짜 클릭 팝업
  const [datePopup, setDatePopup] = useState<string | null>(null);
  const [popupTags, setPopupTags] = useState<ScheduleTag[]>([]);
  const [popupTimeStart, setPopupTimeStart] = useState('');
  const [popupTimeEnd, setPopupTimeEnd] = useState('');
  const [popupCustom, setPopupCustom] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [showReview, setShowReview] = useState(false);

  const calendarRef = useRef<HTMLDivElement>(null);

  // 사용자가 제출 버튼 클릭 → 검토 모달 띄움
  const handleReviewOpen = () => {
    if (!clinicName.trim() || !doctorName.trim()) {
      setError('치과명과 성함을 입력해주세요');
      return;
    }
    setError('');
    setShowReview(true);
  };

  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDay = getFirstDayOfWeek(calYear, calMonth);

  const prevMonth = () => { if (calMonth === 1) { setCalYear(calYear - 1); setCalMonth(12); } else setCalMonth(calMonth - 1); };
  const nextMo = () => { if (calMonth === 12) { setCalYear(calYear + 1); setCalMonth(1); } else setCalMonth(calMonth + 1); };

  const handleDateClick = (dateStr: string) => {
    setPopupTags(dateSchedules[dateStr] || []);
    const existing = dateTimes[dateStr] || '';
    const [s, e] = existing.includes('~') ? existing.split('~') : ['', existing];
    setPopupTimeStart(s);
    setPopupTimeEnd(e);
    setPopupCustom(customLabels[dateStr] || '');
    setDatePopup(dateStr);
  };

  const savePopup = () => {
    if (!datePopup) return;
    const newSchedules = { ...dateSchedules };
    if (popupTags.length > 0) newSchedules[datePopup] = popupTags;
    else delete newSchedules[datePopup];
    setDateSchedules(newSchedules);

    const newTimes = { ...dateTimes };
    const timeStr = popupTimeStart && popupTimeEnd
      ? `${popupTimeStart}~${popupTimeEnd}`
      : popupTimeEnd ? `~${popupTimeEnd}` : popupTimeStart ? `${popupTimeStart}~` : '';
    if (timeStr) newTimes[datePopup] = timeStr;
    else delete newTimes[datePopup];
    setDateTimes(newTimes);

    const newLabels = { ...customLabels };
    if (popupCustom.trim()) newLabels[datePopup] = popupCustom.trim();
    else delete newLabels[datePopup];
    setCustomLabels(newLabels);

    setDatePopup(null);
  };

  const clearPopupDate = () => {
    if (!datePopup) return;
    const { [datePopup]: _1, ...s } = dateSchedules;
    const { [datePopup]: _2, ...t } = dateTimes;
    const { [datePopup]: _3, ...l } = customLabels;
    setDateSchedules(s);
    setDateTimes(t);
    setCustomLabels(l);
    setDatePopup(null);
  };

  const togglePrintSize = (size: string) =>
    setPrintSizes(prev => prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size]);

  const canSubmit = clinicName.trim() && doctorName.trim();
  const hasHoliday = Object.values(dateSchedules).some(tags => tags.includes('휴진'));

  const captureCalendarImage = async (): Promise<string | null> => {
    if (!calendarRef.current) return null;
    try {
      // html2canvas(1.4.1)는 일부 모던 CSS에서 무음 실패 → 브라우저 네이티브 렌더 기반 html-to-image로 교체.
      const { toBlob } = await import('html-to-image');
      const blob = await toBlob(calendarRef.current, {
        type: 'image/webp',     // webp 저용량
        quality: 0.85,
        pixelRatio: 2,          // 선명하게
        backgroundColor: '#ffffff',
        cacheBust: true,
      });
      if (!blob) return null;
      const ext = blob.type.includes('webp') ? 'webp' : blob.type.includes('png') ? 'png' : 'jpg';
      const formData = new FormData();
      formData.append('image', blob, `calendar.${ext}`);
      const up = await fetch('/api/upload-calendar', { method: 'POST', body: formData });
      const upData = await up.json();
      return upData.success ? upData.fileUploadId : null;
    } catch {
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setShowReview(false);
    setSubmitting(true);
    setError('');
    // 일정데이터: 태그 일정 + 커스텀 휴무(직접입력)를 날짜순으로 합침
    const summaryRows: { day: number; line: string }[] = [];
    for (const [date, tags] of Object.entries(dateSchedules)) {
      if (!tags.length) continue;
      const d = parseInt(date.split('-')[2]);
      const h = isHoliday(date);
      const timeNote = dateTimes[date]?.trim();
      const tagsLabel = tags.map(t => t).join(', ') + (timeNote ? ` (${timeNote})` : '');
      summaryRows.push({ day: d, line: `${h ? `${d}일(${h.name})` : `${d}일`}: ${tagsLabel}` });
    }
    for (const [date, label] of Object.entries(customLabels)) {
      if (!label.trim()) continue;
      const d = parseInt(date.split('-')[2]);
      const timeNote = dateTimes[date]?.trim();
      const line = timeNote ? `${d}일: ${label.trim()} (${timeNote})` : `${d}일: ${label.trim()}`;
      summaryRows.push({ day: d, line });
    }
    // 태그·사유 없이 시간만 설정된 날짜도 누락 없이 포함
    const coveredDays = new Set(summaryRows.map(r => r.day));
    for (const [date, time] of Object.entries(dateTimes)) {
      const t = time.trim();
      if (!t) continue;
      const d = parseInt(date.split('-')[2]);
      if (!coveredDays.has(d)) summaryRows.push({ day: d, line: `${d}일: 진료시간 ${t}` });
    }
    const scheduleSummary = summaryRows.sort((a, b) => a.day - b.day).map(r => r.line).join('\n');

    // 달력 이미지 캡처 → 노션 업로드 (실패해도 제출은 계속)
    const calendarFileUploadId = await captureCalendarImage();

    try {
      const res = await fetch('/api/schedule-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicName: clinicName.trim(), doctorName: doctorName.trim(),
          targetMonth: `${calYear}년 ${calMonth}월`, calYear, calMonth,
          scheduleData: scheduleSummary, dateSchedulesRaw: dateSchedules,
          events: events.trim(), printSizes,
          calendarText: calendarText.trim() || undefined,
          customLabels,
          dateTimes,
          templateType: designChoice || undefined,
          specialNote: specialNote.trim() || undefined,
          extraRequest: extraRequest.trim(), holidayReason: holidayReason.trim(),
          calendarFileUploadId: calendarFileUploadId || undefined,
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
  return (
    <div className="min-h-screen bg-[#F8FAFC]">

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
              <span className="w-6 h-6 rounded-full bg-[#2563EB] text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
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

          {/* STEP 2: 시안 선택 */}
          <section className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
            <div className="px-5 pt-5 pb-4 border-b border-[#F3F4F6]">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-6 h-6 rounded-full bg-[#2563EB] text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
                <h3 className="font-semibold text-[#374151]">원하시는 디자인 시안을 선택해 주세요</h3>
              </div>
              <p className="text-sm text-[#6B7280] ml-8">선택하신 시안으로 달력을 제작해 드립니다</p>
            </div>

            <div className="p-4 grid grid-cols-2 gap-3">
              {(['A', 'B', 'C', 'D', 'E'] as const).map(letter => {
                const meta: Record<string, { desc: string; accent: string }> = {
                  A: { desc: '단풍·정자', accent: '#DC2626' },
                  B: { desc: '보름달·한옥', accent: '#EC4899' },
                  C: { desc: '학·전통문양', accent: '#1E3A5F' },
                  D: { desc: '감나무·노을', accent: '#0EA5E9' },
                  E: { desc: '보름달·풍등', accent: '#7C3AED' },
                };
                const { desc, accent } = meta[letter];
                const isSelected = designChoice === letter;
                return (
                  <button
                    key={letter}
                    type="button"
                    onClick={() => setDesignChoice(isSelected ? '' : letter)}
                    className="relative rounded-xl overflow-hidden border-2 transition-all active:scale-95"
                    style={{ borderColor: isSelected ? accent : '#E5E7EB' }}
                  >
                    {/* 썸네일 이미지 */}
                    <div className="w-full aspect-square bg-[#F8FAFC] overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/designs/진료일정_시안_${letter}.jpg`}
                        alt={`시안 ${letter}`}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* 라벨 */}
                    <div className="px-3 py-2 text-left" style={{ backgroundColor: isSelected ? accent + '12' : '#fff' }}>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold" style={{ color: accent }}>시안 {letter}</span>
                        {isSelected && (
                          <span className="ml-auto w-4 h-4 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: accent }}>
                            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[#9CA3AF] leading-tight mt-0.5">{desc}</p>
                    </div>

                  </button>
                );
              })}
            </div>

            {!designChoice && (
              <p className="px-5 pb-4 text-xs text-[#9CA3AF]">※ 선택 안 하시면 디자이너가 적합한 시안으로 제작합니다</p>
            )}
          </section>

          {/* STEP 3: 진료일정 달력 */}
          <section ref={calendarRef} className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
            {/* 스텝 헤더 */}
            <div className="px-5 pt-5 pb-4 border-b border-[#F3F4F6]">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-6 h-6 rounded-full bg-[#2563EB] text-white text-xs font-bold flex items-center justify-center shrink-0">3</span>
                <h3 className="font-semibold text-[#374151]">달력에 일정을 표시해 주세요</h3>
              </div>
              <p className="text-sm text-[#6B7280] ml-8">날짜를 탭하면 일정 유형과 시간을 설정할 수 있어요</p>
            </div>

            {/* 안내 + 전체 지우기 */}
            <div className="px-5 py-3 bg-[#F8FAFC] border-b border-[#E5E7EB] flex items-center justify-between gap-3">
              <p className="text-sm text-[#6B7280]">📅 날짜를 탭하면 일정과 시간을 설정할 수 있어요</p>
              <button
                onClick={() => {
                  if (Object.keys(dateSchedules).length === 0 && Object.keys(customLabels).length === 0 && Object.keys(dateTimes).length === 0) return;
                  if (confirm('달력에 표시된 모든 일정을 초기화할까요?')) {
                    setDateSchedules({});
                    setCustomLabels({});
                    setDateTimes({});
                  }
                }}
                className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-white border border-[#E5E7EB] text-[#6B7280] hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-all"
              >
                🧹 초기화
              </button>
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
                  const customLabel = customLabels[dateStr];
                  const cellTime = dateTimes[dateStr] || '';

                  return (
                    <button
                      key={day}
                      onClick={() => handleDateClick(dateStr)}
                      className="h-24 border-b border-r border-[#F3F4F6] flex flex-col items-center pt-1.5 pb-1 relative transition-all hover:opacity-80 cursor-pointer"
                      style={primaryTag ? { backgroundColor: primaryTag.bg + '90' } : customLabel ? { backgroundColor: '#FEE2E290' } : {}}
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
                      {cellTime && (
                        <span className="mt-0.5 text-[9px] font-bold leading-none text-[#1E3A5F]">{cellTime}</span>
                      )}
                      {customLabel && (
                        <div className="mt-1 w-full px-1">
                          <span className="block w-full text-center text-[9px] font-bold leading-tight py-0.5 rounded"
                            style={{ backgroundColor: '#92400E', color: '#fff' }}>
                            {customLabel}
                          </span>
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
              <span className="w-6 h-6 rounded-full bg-[#2563EB] text-white text-xs font-bold flex items-center justify-center shrink-0">5</span>
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

            {/* 달력 표기 필수내용 */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-[#374151]">달력에 꼭 표기할 내용</label>
              <textarea
                value={calendarText}
                onChange={e => setCalendarText(e.target.value)}
                placeholder={`예:\n화 야간진료\n일 정기휴무\n목 정기휴무`}
                rows={4}
                className="w-full px-4 py-3 rounded-xl border border-[#D1D5DB] text-sm resize-none
                           focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition-all"
              />
            </div>

            {/* 특이사항/병원요청 */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-[#374151]">
                특이사항 / 병원 요청사항
              </label>
              <textarea
                value={specialNote}
                onChange={e => setSpecialNote(e.target.value)}
                placeholder={`예: 기본적으로 휴진 있는 주의 목요일은 근무`}
                rows={2}
                className="w-full px-4 py-3 rounded-xl border border-[#D1D5DB] text-sm resize-none
                           focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition-all"
              />
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
            onClick={handleReviewOpen}
            disabled={!canSubmit || submitting}
          >
            {submitting ? '제출 중입니다...' : '📤 진료일정 제출하기'}
          </button>
        </div>
      </main>

      {/* 날짜 일정 팝업 */}
      {datePopup && (() => {
        const hasTime = popupTimeStart || popupTimeEnd;
        return (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center sm:items-center"
            onClick={() => setDatePopup(null)}>
            <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-sm shadow-2xl"
              onClick={e => e.stopPropagation()}>

              {/* 헤더 */}
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <div>
                  <p className="text-lg font-bold text-[#111827]">
                    {calMonth}월 {parseInt(datePopup.split('-')[2])}일
                  </p>
                  <p className="text-xs text-[#9CA3AF] mt-0.5">일정을 설정해 주세요</p>
                </div>
                <button onClick={() => setDatePopup(null)}
                  className="w-8 h-8 rounded-full bg-[#F3F4F6] flex items-center justify-center text-[#6B7280]">
                  ✕
                </button>
              </div>

              <div className="px-5 pb-5 space-y-5">
                {/* 일정 유형 */}
                <div>
                  <p className="text-xs font-semibold text-[#6B7280] mb-2.5">일정 유형</p>
                  <div className="flex flex-wrap gap-2">
                    {SCHEDULE_TAGS.map(tag => {
                      const isOn = popupTags.includes(tag.label);
                      return (
                        <button key={tag.label}
                          onClick={() => setPopupTags(prev =>
                            prev.includes(tag.label) ? prev.filter(t => t !== tag.label) : [...prev, tag.label]
                          )}
                          className="px-3.5 py-2 rounded-2xl text-sm font-semibold border-2 transition-all active:scale-95"
                          style={isOn
                            ? { backgroundColor: tag.color, color: '#fff', borderColor: tag.color }
                            : { backgroundColor: tag.bg, color: tag.color, borderColor: 'transparent' }
                          }
                        >
                          {tag.emoji} {tag.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 진료시간 변경 */}
                <div>
                  <p className="text-xs font-semibold text-[#6B7280] mb-2.5">
                    이날 진료시간 변경
                    <span className="font-normal text-[#9CA3AF] ml-1">(선택)</span>
                  </p>

                  {/* 빠른 선택 칩 */}
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {[
                      { label: '오전만', emoji: '🌅', start: '09:00', end: '13:00' },
                      { label: '단축', emoji: '⏰', start: '', end: '15:00' },
                      { label: '야간', emoji: '🌙', start: '09:00', end: '21:00' },
                      { label: '없음', emoji: '✕', start: '', end: '' },
                    ].map(p => {
                      const isOn = p.start === popupTimeStart && p.end === popupTimeEnd && (p.start || p.end);
                      return (
                        <button key={p.label}
                          onClick={() => { setPopupTimeStart(p.start); setPopupTimeEnd(p.end); }}
                          className={`flex flex-col items-center gap-0.5 py-2.5 rounded-2xl text-xs font-semibold transition-all active:scale-95
                            ${isOn ? 'bg-[#2563EB] text-white shadow-md' : 'bg-[#F3F4F6] text-[#374151]'}`}
                        >
                          <span className="text-base leading-none">{p.emoji}</span>
                          <span>{p.label}</span>
                          {(p.start || p.end) && (
                            <span className={`text-[10px] leading-none ${isOn ? 'text-blue-200' : 'text-[#9CA3AF]'}`}>
                              {p.start && p.end ? `${p.start}~${p.end}` : p.end ? `~${p.end}` : ''}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* 시작/종료 시간 버튼 피커 */}
                  <div className="bg-[#F9FAFB] rounded-2xl p-3 space-y-3">
                    <HourPicker label="시작" value={popupTimeStart} onChange={setPopupTimeStart} />
                    <div className="border-t border-[#E5E7EB]" />
                    <HourPicker label="종료" value={popupTimeEnd} onChange={setPopupTimeEnd} />
                  </div>
                  {(popupTimeStart || popupTimeEnd) && (
                    <p className="text-center text-sm font-bold text-[#2563EB] mt-2">
                      {popupTimeStart || '--:--'} ~ {popupTimeEnd || '--:--'}
                    </p>
                  )}
                </div>

                {/* 달력 표기 사유 */}
                <div>
                  <label className="text-xs font-semibold text-[#6B7280] mb-2 block">
                    달력 표기 사유
                    <span className="font-normal text-[#9CA3AF] ml-1">(선택 · 예: 원장 세미나)</span>
                  </label>
                  <input
                    type="text"
                    value={popupCustom}
                    onChange={e => setPopupCustom(e.target.value)}
                    placeholder="예: 원장 학회, 건물 공사"
                    className="w-full h-12 px-4 rounded-2xl border-2 border-[#E5E7EB] text-sm bg-[#F9FAFB]
                               focus:outline-none focus:border-[#2563EB] focus:bg-white transition-all"
                  />
                </div>

                {/* 버튼 */}
                <div className="flex gap-2">
                  <button onClick={clearPopupDate}
                    className="flex-1 h-12 rounded-2xl text-sm font-semibold text-red-500 bg-red-50 active:scale-95 transition-all">
                    초기화
                  </button>
                  <button onClick={savePopup}
                    className="flex-[2] h-12 rounded-2xl text-sm font-semibold text-white bg-[#2563EB] shadow-md shadow-blue-200 active:scale-95 transition-all">
                    저장하기
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      <ReviewModal
        open={showReview}
        title={`${calYear}년 ${calMonth}월 진료일정 확인`}
        warning="이대로 제출하면 노션 진료일정 DB에 페이지가 생성되며, 거래처 매칭은 입력한 치과명이 거래처 DB와 정확히 일치해야 자동 연결됩니다."
        items={[
          { label: '치과명', value: clinicName },
          { label: '성함', value: doctorName },
          { label: '대상월', value: `${calYear}년 ${calMonth}월` },
          { label: '디자인 시안', value: designChoice ? `시안 ${designChoice}` : '미선택' },
          {
            label: '일정 표시 수',
            value: (() => {
              const n = Object.values(dateSchedules).filter((tags) => tags.length > 0).length
                + Object.keys(customLabels).length;
              return n > 0 ? `${n}일` : '없음';
            })(),
          },
          {
            label: '직접입력 휴무',
            value: Object.entries(customLabels).map(([d, l]) => `${parseInt(d.split('-')[2])}일 ${l}`).join(', '),
          },
          {
            label: '날짜별 시간 변경',
            value: Object.entries(dateTimes).map(([d, t]) => `${parseInt(d.split('-')[2])}일 ${t}`).join(', '),
          },
          { label: '휴진 사유', value: holidayReason },
          { label: '이벤트', value: events },
          { label: '출력 사이즈', value: printSizes.join(', ') },
          { label: '달력 표기 내용', value: calendarText },
          { label: '특이사항/병원요청', value: specialNote },
          { label: '기타 요청', value: extraRequest },
        ]}
        onCancel={() => setShowReview(false)}
        onConfirm={handleSubmit}
        submitting={submitting}
      />
    </div>
  );
}
