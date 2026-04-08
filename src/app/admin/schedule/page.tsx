'use client';

import { useState, useEffect, useCallback } from 'react';
import { isHoliday } from '@/data/holidays';

// 태그 정의
const SCHEDULE_TAGS = {
  '휴진': { color: '#DC2626', bg: '#450a0a', light: '#FEE2E2' },
  '토요일진료': { color: '#7C3AED', bg: '#2e1065', light: '#EDE9FE' },
  '일요일진료': { color: '#BE185D', bg: '#4a044e', light: '#FCE7F3' },
  '오전진료': { color: '#059669', bg: '#022c22', light: '#D1FAE5' },
  '오후진료': { color: '#D97706', bg: '#451a03', light: '#FEF3C7' },
  '야간진료': { color: '#0891B2', bg: '#082f49', light: '#CFFAFE' },
  '공휴일진료': { color: '#BE185D', bg: '#4a044e', light: '#FCE7F3' },
} as const;

type TagKey = keyof typeof SCHEDULE_TAGS;

interface ScheduleRecord {
  id: string;
  clinicName: string;
  doctorName: string;
  targetMonth: string;
  scheduleData: string;
  events: string;
  printSizes: string[];
  extraRequest: string;
  status: string;
  assignee: string;
  submittedAt: string;
  tagData: Record<string, string>;
}

// tagData에서 day number -> tags 맵 재구성
function buildDateTagMap(tagData: Record<string, string>): Record<number, string[]> {
  const map: Record<number, string[]> = {};
  for (const [tag, dateStr] of Object.entries(tagData)) {
    if (!dateStr) continue;
    const parts = dateStr.split(',').map((s) => s.trim());
    for (const part of parts) {
      const dayMatch = part.match(/^(\d+)일/);
      if (dayMatch) {
        const day = parseInt(dayMatch[1]);
        if (!map[day]) map[day] = [];
        map[day].push(tag);
      }
    }
  }
  return map;
}

function parseTargetMonth(targetMonth: string): { year: number; month: number } {
  const m = targetMonth.match(/(\d+)년\s*(\d+)월/);
  if (m) return { year: parseInt(m[1]), month: parseInt(m[2]) };
  return { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
}

function getPrimaryTag(tags: string[]): TagKey | null {
  const priority: TagKey[] = ['휴진', '공휴일진료', '토요일진료', '일요일진료', '야간진료', '오전진료', '오후진료'];
  for (const p of priority) {
    if (tags.includes(p)) return p;
  }
  return (tags[0] as TagKey) || null;
}

function getDaysInMonth(year: number, month: number) { return new Date(year, month, 0).getDate(); }
function getFirstDay(year: number, month: number) { return new Date(year, month - 1, 1).getDay(); }

// 달력 컴포넌트
function ScheduleCalendar({ record }: { record: ScheduleRecord }) {
  const { year, month } = parseTargetMonth(record.targetMonth);
  const dateTagMap = buildDateTagMap(record.tagData);
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDay(year, month);
  const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

  const taggedDays = Object.entries(dateTagMap).sort(([a], [b]) => parseInt(a) - parseInt(b));

  const allChips: { day: number; tag: string; holiday?: string }[] = [];
  for (const [dayStr, tags] of taggedDays) {
    const day = parseInt(dayStr);
    const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const holiday = isHoliday(dateKey)?.name;
    for (const tag of tags) {
      allChips.push({ day, tag, holiday });
    }
  }

  return (
    <div className="space-y-4">
      {allChips.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 mb-2">표시 일정</p>
          <div className="flex flex-wrap gap-1.5">
            {allChips.map((chip, i) => {
              const t = SCHEDULE_TAGS[chip.tag as TagKey];
              return (
                <span
                  key={i}
                  className="px-2 py-1 rounded text-xs font-medium"
                  style={{
                    backgroundColor: t?.bg || '#333',
                    color: t?.color || '#fff',
                    border: `1px solid ${t?.color ?? '#fff'}40`,
                  }}
                >
                  {chip.day}일{chip.holiday ? `(${chip.holiday})` : ''} {chip.tag}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className="rounded-xl overflow-hidden border border-white/10">
        <div className="grid grid-cols-7 bg-white/5">
          {WEEKDAYS.map((d, i) => (
            <div
              key={d}
              className={`text-center py-2 text-xs font-semibold ${
                i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'
              }`}
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`e${i}`} className="h-12 border-b border-r border-white/5" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dayOfWeek = (firstDay + i) % 7;
            const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const holiday = isHoliday(dateKey)?.name;
            const tags = dateTagMap[day] || [];
            const primaryTag = getPrimaryTag(tags);
            const t = primaryTag ? SCHEDULE_TAGS[primaryTag] : null;
            const isSun = dayOfWeek === 0;
            const isSat = dayOfWeek === 6;

            return (
              <div
                key={day}
                className="h-12 border-b border-r border-white/5 flex flex-col items-center justify-center relative"
                style={t ? { backgroundColor: t.bg } : {}}
              >
                <span
                  className={`text-xs font-medium ${
                    t ? '' : holiday || isSun ? 'text-red-400' : isSat ? 'text-blue-400' : 'text-gray-200'
                  }`}
                  style={t ? { color: t.color } : {}}
                >
                  {day}
                </span>
                {primaryTag && (
                  <span className="text-[9px] leading-none mt-0.5 font-medium" style={{ color: t?.color }}>
                    {primaryTag}
                  </span>
                )}
                {tags.length > 1 && (
                  <span className="text-[8px] text-gray-400">+{tags.length - 1}</span>
                )}
                {holiday && !primaryTag && (
                  <span className="text-[8px] text-red-400 leading-none">
                    {holiday.length > 4 ? holiday.slice(0, 4) : holiday}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const STATUS_OPTIONS = ['접수', '제작중', '검토요청', '완료'];
const STATUS_COLORS: Record<string, string> = {
  '접수': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  '제작중': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  '검토요청': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  '완료': 'bg-green-500/20 text-green-300 border-green-500/30',
};
const ASSIGNEES = ['미배정', '이하은', '김민지', '박서연'];
const PRINT_SIZE_COLORS: Record<string, string> = {
  '팝업(가로)': 'bg-purple-500/30 text-purple-200',
  '팝업(세로)': 'bg-blue-500/30 text-blue-200',
  'A4(가로)': 'bg-green-500/30 text-green-200',
  'A4(세로)': 'bg-teal-500/30 text-teal-200',
  '세로형 DID': 'bg-orange-500/30 text-orange-200',
  '가로형 DID': 'bg-red-500/30 text-red-200',
};

export default function AdminSchedulePage() {
  const [records, setRecords] = useState<ScheduleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(() => {
    const now = new Date();
    return now.getMonth() + 2 > 12 ? now.getFullYear() + 1 : now.getFullYear();
  });
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().getMonth() + 2 > 12 ? 1 : new Date().getMonth() + 2
  );
  const [search, setSearch] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const targetMonth = `${selectedYear}년 ${selectedMonth}월`;

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/schedules?month=${encodeURIComponent(targetMonth)}`);
      const data = await res.json() as { success: boolean; records: ScheduleRecord[] };
      if (data.success) setRecords(data.records);
    } catch {
      // ignore
    }
    setLoading(false);
  }, [targetMonth]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const selectedRecord = records.find((r) => r.id === selectedId);

  const updateRecord = async (id: string, updates: Record<string, unknown>) => {
    setUpdatingId(id);
    await fetch(`/api/admin/schedule/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    await fetchRecords();
    setUpdatingId(null);
  };

  const deleteRecord = async (id: string) => {
    if (!confirm('이 항목을 삭제하시겠습니까?')) return;
    await fetch(`/api/admin/schedule/${id}`, { method: 'DELETE' });
    if (selectedId === id) setSelectedId(null);
    await fetchRecords();
  };

  const filtered = records.filter(
    (r) => !search || r.clinicName.includes(search) || r.doctorName.includes(search)
  );

  const getPreviewChips = (r: ScheduleRecord) => {
    const chips: { label: string; tag: string }[] = [];
    for (const [tag, dateStr] of Object.entries(r.tagData)) {
      if (!dateStr) continue;
      const parts = dateStr.split(',').map((s) => s.trim());
      for (const part of parts.slice(0, 2)) {
        chips.push({ label: `${part} ${tag}`, tag });
      }
    }
    return chips.slice(0, 5);
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-white flex flex-col">
      {/* 헤더 */}
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xl">📋</span>
          <div>
            <h1 className="text-base font-bold">진료일정 관리자</h1>
            <p className="text-xs text-gray-400">목록 클릭 → 달력 상세 보기</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">총 {filtered.length}건</span>
          <a
            href="/"
            className="text-xs text-gray-400 hover:text-white border border-white/10 rounded px-2 py-1"
          >
            ← 홈
          </a>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* 좌측 리스트 패널 */}
        <aside className="w-[380px] flex-shrink-0 border-r border-white/10 flex flex-col">
          <div className="px-4 pt-4 pb-2">
            {/* 연도 탭 */}
            <div className="flex gap-2 mb-3">
              {[2025, 2026, 2027].map((y) => (
                <button
                  key={y}
                  onClick={() => setSelectedYear(y)}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    selectedYear === y ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
            {/* 월 탭 */}
            <div className="grid grid-cols-6 gap-1 mb-3">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                <button
                  key={m}
                  onClick={() => setSelectedMonth(m)}
                  className={`py-1.5 rounded text-xs font-medium transition-colors ${
                    selectedMonth === m
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {m}월
                </button>
              ))}
            </div>
            {/* 검색 */}
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="치과명 검색..."
              className="w-full h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* 리스트 */}
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-gray-500 text-sm">
                불러오는 중...
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-gray-500 text-sm">
                {selectedMonth}월 제출 내역이 없습니다
              </div>
            ) : (
              filtered.map((r, idx) => {
                const previewChips = getPreviewChips(r);
                const totalTagCount = Object.values(r.tagData)
                  .filter(Boolean)
                  .flatMap((s) => s.split(','))
                  .filter(Boolean).length;
                const statusColor = STATUS_COLORS[r.status] || STATUS_COLORS['접수'];
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelectedId(r.id === selectedId ? null : r.id)}
                    className={`w-full text-left rounded-xl p-3 border transition-all ${
                      selectedId === r.id
                        ? 'bg-blue-600/20 border-blue-500/50'
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs text-gray-500 flex-shrink-0">{idx + 1}</span>
                        <span className="font-semibold text-sm truncate">{r.clinicName}</span>
                        <span className="text-xs text-gray-400 flex-shrink-0">{r.doctorName}</span>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border flex-shrink-0 ${statusColor}`}>
                        {r.status}
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-500 mb-2">
                      {r.targetMonth} · 제출 {r.submittedAt}
                    </div>
                    {previewChips.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {previewChips.map((chip, i) => {
                          const t = SCHEDULE_TAGS[chip.tag as TagKey];
                          return (
                            <span
                              key={i}
                              className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                              style={{
                                backgroundColor: t?.bg,
                                color: t?.color,
                                border: `1px solid ${t?.color ?? '#fff'}30`,
                              }}
                            >
                              {chip.label}
                            </span>
                          );
                        })}
                        {totalTagCount > previewChips.length && (
                          <span className="text-[9px] text-gray-500">
                            +{totalTagCount - previewChips.length}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="flex gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => deleteRecord(r.id)}
                        className="text-[10px] text-red-400 hover:text-red-300"
                      >
                        삭제
                      </button>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* 우측 상세 패널 */}
        <main className="flex-1 overflow-y-auto p-6">
          {!selectedRecord ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-600">
              <span className="text-5xl mb-4">📅</span>
              <p className="text-sm">좌측에서 거래처를 선택하세요</p>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto space-y-6">
              {/* 헤더 */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold">{selectedRecord.clinicName}</h2>
                  <p className="text-sm text-gray-400 mt-0.5">
                    원장: {selectedRecord.doctorName} · {selectedRecord.targetMonth} · 제출{' '}
                    {selectedRecord.submittedAt}
                  </p>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded border ${
                    STATUS_COLORS[selectedRecord.status] || ''
                  }`}
                >
                  {selectedRecord.status}
                </span>
              </div>

              {/* 달력 */}
              <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
                <ScheduleCalendar record={selectedRecord} />
              </div>

              {/* 이벤트 */}
              {selectedRecord.events && (
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <p className="text-xs text-yellow-400 font-semibold mb-2">다음달 이벤트</p>
                  <p className="text-sm text-gray-200 whitespace-pre-line">{selectedRecord.events}</p>
                </div>
              )}

              {/* 기타 요청 */}
              {selectedRecord.extraRequest && (
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <p className="text-xs text-gray-400 font-semibold mb-2">기타 요청사항</p>
                  <p className="text-sm text-gray-200 whitespace-pre-line">
                    {selectedRecord.extraRequest}
                  </p>
                </div>
              )}

              {/* 출력 사이즈 */}
              {selectedRecord.printSizes.length > 0 && (
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <p className="text-xs text-gray-400 font-semibold mb-2">출력 사이즈</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedRecord.printSizes.map((s) => (
                      <span
                        key={s}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                          PRINT_SIZE_COLORS[s] || 'bg-white/10 text-gray-200'
                        }`}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 관리자 설정 */}
              <div className="bg-white/5 rounded-xl p-4 border border-white/10 space-y-4">
                <p className="text-xs text-gray-400 font-semibold">관리자 설정</p>

                {/* 처리 상태 */}
                <div>
                  <p className="text-xs text-gray-500 mb-2">처리 상태</p>
                  <div className="flex gap-2 flex-wrap">
                    {STATUS_OPTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => updateRecord(selectedRecord.id, { status: s })}
                        disabled={updatingId === selectedRecord.id}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          selectedRecord.status === s
                            ? STATUS_COLORS[s]
                            : 'border-white/10 text-gray-400 hover:border-white/30'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 담당자 */}
                <div>
                  <p className="text-xs text-gray-500 mb-2">담당자</p>
                  <div className="flex gap-2 flex-wrap">
                    {ASSIGNEES.map((a) => (
                      <button
                        key={a}
                        onClick={() =>
                          updateRecord(selectedRecord.id, { assignee: a === '미배정' ? '' : a })
                        }
                        disabled={updatingId === selectedRecord.id}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          (selectedRecord.assignee || '미배정') === a
                            ? 'bg-blue-600/30 border-blue-500/50 text-blue-300'
                            : 'border-white/10 text-gray-400 hover:border-white/30'
                        }`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
