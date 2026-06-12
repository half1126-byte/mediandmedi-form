'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
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
  doctorTime: string;
  calendarText: string;
  specialNote: string;
  holidayReason: string;
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

// 태그 데이터 끝의 (시간) 꼬리표 추출: "7일, 14일 (~21:00)" -> "~21:00"
// (폼 '달력 칸 시간 표기' 토글이 태그별 시간을 괄호로 덧붙여 저장함)
function extractTagTime(dateStr: string): string {
  const m = dateStr.match(/\(([^()]+)\)\s*$/);
  if (m && /[:~]/.test(m[1])) return m[1].trim();
  return '';
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
  // 태그별 시간(예: 야간진료 -> ~21:00) — 달력 칸에 태그명 밑줄로 표기
  const tagTimeMap: Record<string, string> = {};
  for (const [tag, ds] of Object.entries(record.tagData)) {
    const tm = extractTagTime(ds);
    if (tm) tagTimeMap[tag] = tm;
  }
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDay(year, month);
  const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

  // 태그 종류별 날짜 묶음 (표시 일정 요약 — 태그당 한 줄)
  const TAG_SUMMARY_ORDER: TagKey[] = ['오전진료', '오후진료', '야간진료', '토요일진료', '일요일진료', '공휴일진료', '휴진'];
  const tagDayMap: Record<string, number[]> = {};
  for (const [dayStr, tags] of Object.entries(dateTagMap)) {
    const day = parseInt(dayStr);
    for (const tag of tags) {
      if (!tagDayMap[tag]) tagDayMap[tag] = [];
      tagDayMap[tag].push(day);
    }
  }
  Object.values(tagDayMap).forEach((arr) => arr.sort((a, b) => a - b));
  const summaryTags = TAG_SUMMARY_ORDER.filter((tag) => tagDayMap[tag]?.length);

  return (
    <div className="space-y-4">
      {summaryTags.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 mb-2">표시 일정</p>
          <div className="space-y-1.5">
            {summaryTags.map((tag) => {
              const t = SCHEDULE_TAGS[tag];
              const days = tagDayMap[tag];
              const time = tagTimeMap[tag];
              return (
                <div key={tag} className="flex items-start gap-2 text-[13px]">
                  <span
                    className="flex-shrink-0 px-2 py-0.5 rounded-md font-semibold whitespace-nowrap"
                    style={{ backgroundColor: t.bg, color: t.light, border: `1px solid ${t.color}55` }}
                  >
                    {tag} {days.length}
                  </span>
                  {time && (
                    <span className="flex-shrink-0 font-semibold pt-0.5 tabular-nums" style={{ color: t.light }}>
                      {time}
                    </span>
                  )}
                  <span className="text-gray-300 leading-relaxed pt-0.5">{days.join(' · ')}</span>
                </div>
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
              className={`text-center py-2.5 text-sm font-bold ${
                i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-300'
              }`}
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`e${i}`} className="h-[92px] border-b border-r border-white/5" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dayOfWeek = (firstDay + i) % 7;
            const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const holiday = isHoliday(dateKey)?.name;
            const tags = dateTagMap[day] || [];
            const primaryTag = getPrimaryTag(tags);
            const t = primaryTag ? SCHEDULE_TAGS[primaryTag] : null;
            // 대표 태그(칸 배경색)를 맨 위로, 나머지 태그는 그 아래로
            const sortedTags = primaryTag ? [primaryTag, ...tags.filter((x) => x !== primaryTag)] : tags;
            const isSun = dayOfWeek === 0;
            const isSat = dayOfWeek === 6;

            return (
              <div
                key={day}
                className="h-[92px] border-b border-r border-white/5 flex flex-col items-center justify-center gap-0.5 overflow-hidden px-0.5"
                style={t ? { backgroundColor: t.bg } : {}}
              >
                <span
                  className={`text-sm font-bold ${
                    t ? '' : holiday || isSun ? 'text-red-400' : isSat ? 'text-blue-400' : 'text-gray-100'
                  }`}
                  style={t ? { color: t.light } : {}}
                >
                  {day}
                </span>
                {sortedTags.map((tag) => {
                  const tg = SCHEDULE_TAGS[tag as TagKey];
                  const time = tagTimeMap[tag];
                  return (
                    <span key={tag} className="flex flex-col items-center leading-tight">
                      <span className="text-[10px] font-semibold text-center" style={{ color: tg?.light }}>
                        {tag}
                      </span>
                      {time && (
                        <span
                          className="text-[9px] font-medium text-center tabular-nums"
                          style={{ color: tg?.light, opacity: 0.9 }}
                        >
                          {time}
                        </span>
                      )}
                    </span>
                  );
                })}
                {holiday && sortedTags.length === 0 && (
                  <span className="text-[9px] text-red-300 leading-tight text-center">
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

// 변경DB '처리상태_폼' select 옵션과 1:1 일치 (신규 옵션 생성 방지)
const STATUS_OPTIONS = ['접수', '검토', '처리완료'];
const STATUS_COLORS: Record<string, string> = {
  '접수': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  '검토': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  '처리완료': 'bg-green-500/20 text-green-300 border-green-500/30',
};
// 변경DB '출력사이즈' multi_select 옵션과 일치
const PRINT_SIZE_COLORS: Record<string, string> = {
  'A4': 'bg-green-500/30 text-green-200',
  '팝업': 'bg-purple-500/30 text-purple-200',
  '가로 DID': 'bg-red-500/30 text-red-200',
  '세로 DID': 'bg-orange-500/30 text-orange-200',
};

// 중복 통합 대상 필드 (성함 + 7개 태그 + 본문 필드 + 출력사이즈)
const MERGE_TAG_KEYS = ['휴진', '토요일진료', '일요일진료', '오전진료', '오후진료', '야간진료', '공휴일진료'] as const;
const MERGE_FIELDS: { key: string; label: string }[] = [
  { key: '성함', label: '성함' },
  { key: '휴진', label: '휴진' },
  { key: '토요일진료', label: '토요일진료' },
  { key: '일요일진료', label: '일요일진료' },
  { key: '오전진료', label: '오전진료' },
  { key: '오후진료', label: '오후진료' },
  { key: '야간진료', label: '야간진료' },
  { key: '공휴일진료', label: '공휴일진료' },
  { key: '진료시간', label: '진료시간' },
  { key: '이벤트', label: '이벤트' },
  { key: '휴진사유', label: '휴진사유' },
  { key: '달력표기', label: '달력 표기 필수내용' },
  { key: '특이사항', label: '특이사항/병원요청' },
  { key: '기타요청', label: '기타요청' },
  { key: '출력사이즈', label: '출력사이즈' },
];
function mergeFieldVal(r: ScheduleRecord, key: string): string {
  switch (key) {
    case '성함': return r.doctorName;
    case '진료시간': return r.doctorTime;
    case '이벤트': return r.events;
    case '휴진사유': return r.holidayReason;
    case '달력표기': return r.calendarText;
    case '특이사항': return r.specialNote;
    case '기타요청': return r.extraRequest;
    case '출력사이즈': return r.printSizes.join(', ');
    default: return r.tagData[key] || '';
  }
}

export default function AdminSchedulePage() {
  // 인증 상태
  const [authed, setAuthed] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [authId, setAuthId] = useState('');
  const [authInput, setAuthInput] = useState('');
  const [authError, setAuthError] = useState('');

  const verifyToken = useCallback(async (username: string, token: string) => {
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, token }),
      });
      const data = await res.json();
      if (data.success) {
        sessionStorage.setItem('admin_user', username);
        sessionStorage.setItem('admin_token', token);
        setAuthed(true);
      } else {
        sessionStorage.removeItem('admin_user');
        sessionStorage.removeItem('admin_token');
        setAuthError('아이디 또는 비밀번호가 맞지 않습니다');
      }
    } catch {
      setAuthError('서버 연결 실패');
    }
    setAuthChecking(false);
  }, []);

  // 세션에서 복원 (아이디+토큰 둘 다 있을 때만 — async 검증 필수)
  useEffect(() => {
    const savedUser = sessionStorage.getItem('admin_user');
    const savedToken = sessionStorage.getItem('admin_token');
    if (savedUser && savedToken) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      verifyToken(savedUser, savedToken);
    } else {
      setAuthChecking(false);
    }
  }, [verifyToken]);

  const getAuthHeaders = (): HeadersInit => {
    const token = sessionStorage.getItem('admin_token');
    return token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
  };

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
  const [mergeGroup, setMergeGroup] = useState<ScheduleRecord[] | null>(null);
  const [mergeChoices, setMergeChoices] = useState<Record<string, string>>({});
  const [merging, setMerging] = useState(false);

  const targetMonth = `${selectedYear}년 ${selectedMonth}월`;

  const fetchRecords = useCallback(async () => {
    if (!authed) return;
    setLoading(true);
    try {
      const token = sessionStorage.getItem('admin_token');
      const headers: HeadersInit = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(`/api/admin/schedules?month=${encodeURIComponent(targetMonth)}`, { headers });
      if (res.status === 401) { setAuthed(false); sessionStorage.removeItem('admin_token'); return; }
      const data = await res.json() as { success: boolean; records: ScheduleRecord[] };
      if (data.success) setRecords(data.records);
    } catch {
      // ignore
    }
    setLoading(false);
  }, [targetMonth, authed]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const selectedRecord = records.find((r) => r.id === selectedId);

  const updateRecord = async (id: string, updates: Record<string, unknown>) => {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/admin/schedule/${id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates),
      });
      if (!res.ok) alert('수정 실패: 네트워크 오류');
      await fetchRecords();
    } catch {
      alert('수정 실패: 서버에 연결할 수 없습니다');
    }
    setUpdatingId(null);
  };

  const deleteRecord = async (id: string) => {
    if (!confirm('이 항목을 삭제하시겠습니까?')) return;
    try {
      const token = sessionStorage.getItem('admin_token');
      const headers: HeadersInit = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(`/api/admin/schedule/${id}`, { method: 'DELETE', headers });
      if (!res.ok) alert('삭제 실패');
      if (selectedId === id) setSelectedId(null);
      await fetchRecords();
    } catch {
      alert('삭제 실패: 서버에 연결할 수 없습니다');
    }
  };

  // 중복 통합 모달 열기 — 충돌 필드(둘 다 다르게 입력) 기본 선택값 초기화
  const openMerge = (group: ScheduleRecord[]) => {
    const choices: Record<string, string> = {};
    for (const f of MERGE_FIELDS) {
      if (f.key === '출력사이즈') continue; // 출력사이즈는 항상 합집합(자동)
      const distinct = [...new Set(group.map((r) => mergeFieldVal(r, f.key)).filter((v) => v.trim()))];
      if (distinct.length > 1) choices[f.key] = distinct[0];
    }
    setMergeChoices(choices);
    setMergeGroup(group);
  };

  // 통합 확정 — 대표(가장 내용 많은) 레코드에 합치고 나머지는 보관처리
  const confirmMerge = async () => {
    if (!mergeGroup || mergeGroup.length < 2) return;
    setMerging(true);
    const completeness = (r: ScheduleRecord) =>
      MERGE_FIELDS.filter((f) => mergeFieldVal(r, f.key).trim()).length;
    const primary = [...mergeGroup].sort(
      (a, b) => completeness(b) - completeness(a) || (b.submittedAt || '').localeCompare(a.submittedAt || '')
    )[0];
    const archiveIds = mergeGroup.filter((r) => r.id !== primary.id).map((r) => r.id);
    const resolve = (key: string) => {
      const distinct = [...new Set(mergeGroup.map((r) => mergeFieldVal(r, key)).filter((v) => v.trim()))];
      if (distinct.length <= 1) return distinct[0] || '';
      return mergeChoices[key] ?? distinct[0];
    };
    const merged = {
      doctorName: resolve('성함'),
      tagData: Object.fromEntries(MERGE_TAG_KEYS.map((k) => [k, resolve(k)])),
      events: resolve('이벤트'),
      doctorTime: resolve('진료시간'),
      holidayReason: resolve('휴진사유'),
      calendarText: resolve('달력표기'),
      specialNote: resolve('특이사항'),
      extraRequest: resolve('기타요청'),
      printSizes: [...new Set(mergeGroup.flatMap((r) => r.printSizes))],
    };
    try {
      const res = await fetch('/api/admin/schedule/merge', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ primaryId: primary.id, archiveIds, merged }),
      });
      const data = await res.json();
      if (!data.success) {
        alert('통합 실패: ' + (data.error || '오류'));
      } else {
        setMergeGroup(null);
        setSelectedId(primary.id);
        await fetchRecords();
      }
    } catch {
      alert('통합 실패: 서버에 연결할 수 없습니다');
    }
    setMerging(false);
  };

  // 중복 감지: 현재 달 목록에서 같은 거래처가 2건 이상 (실장·직원·원장 각자 제출 등)
  // 거래처명 정규화 — 공백 제거 + 끝의 '의원' 제거로 "○○치과" vs "○○치과의원" 표기차를 흡수
  const normName = (n: string) => n.replace(/\s+/g, '').replace(/의원$/, '');
  const dupCounts: Record<string, number> = {};
  for (const r of records) {
    const k = normName(r.clinicName);
    if (k) dupCounts[k] = (dupCounts[k] || 0) + 1;
  }
  const dupSet = new Set(Object.keys(dupCounts).filter((k) => dupCounts[k] > 1));
  const isDup = (r: ScheduleRecord) => dupSet.has(normName(r.clinicName));
  // 배너 표시용 원본 거래처명 (중복 그룹에 속한 것, 중복 제거)
  const dupNames = [...new Set(records.filter(isDup).map((r) => r.clinicName))];

  const filteredBase = records.filter(
    (r) => !search || r.clinicName.includes(search) || r.doctorName.includes(search)
  );
  // 중복 거래처를 목록 위로 모으고(같은 거래처끼리 인접·최신 제출 먼저), 나머지는 기존 순서 유지
  const dupPart = filteredBase
    .filter(isDup)
    .sort((a, b) =>
      normName(a.clinicName) !== normName(b.clinicName)
        ? normName(a.clinicName).localeCompare(normName(b.clinicName), 'ko')
        : (b.submittedAt || '').localeCompare(a.submittedAt || '')
    );
  const normalPart = filteredBase.filter((r) => !isDup(r));
  const filtered = [...dupPart, ...normalPart];

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

  // 인증 로딩 중
  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <p className="text-gray-400">확인 중...</p>
      </div>
    );
  }

  // 비밀번호 게이트
  if (!authed) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center px-6">
        <div className="w-full max-w-sm space-y-5">
          <div className="text-center">
            <span className="text-4xl">🔒</span>
            <h1 className="text-xl font-bold text-white mt-3">관리자 로그인</h1>
            <p className="text-sm text-gray-400 mt-1">아이디와 비밀번호를 입력해 주세요</p>
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); setAuthError(''); setAuthChecking(true); verifyToken(authId, authInput); }}
            className="space-y-3"
          >
            <input
              type="text"
              value={authId}
              onChange={(e) => setAuthId(e.target.value)}
              placeholder="아이디"
              autoFocus
              autoComplete="username"
              className="w-full h-12 px-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-500
                         focus:outline-none focus:border-blue-500 text-center text-lg"
            />
            <input
              type="password"
              value={authInput}
              onChange={(e) => setAuthInput(e.target.value)}
              placeholder="비밀번호"
              autoComplete="current-password"
              className="w-full h-12 px-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-500
                         focus:outline-none focus:border-blue-500 text-center text-lg tracking-widest"
            />
            {authError && <p className="text-red-400 text-sm text-center">{authError}</p>}
            <button
              type="submit"
              className="w-full h-12 bg-blue-600 text-white rounded-xl font-semibold
                         hover:bg-blue-700 active:scale-[0.98] transition-all"
            >
              로그인
            </button>
          </form>
          <Link href="/" className="block text-center text-xs text-gray-500 hover:text-gray-300">← 홈으로</Link>
        </div>
      </div>
    );
  }

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
          <Link
            href="/"
            className="text-xs text-gray-400 hover:text-white border border-white/10 rounded px-2 py-1"
          >
            ← 홈
          </Link>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* 좌측 리스트 패널 */}
        <aside className="w-[480px] flex-shrink-0 border-r border-white/10 flex flex-col">
          <div className="px-4 pt-4 pb-2">
            {/* 연도 탭 */}
            <div className="flex gap-2 mb-3">
              {[new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1].map((y) => (
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

          {/* 중복 경고 배너 — 같은 거래처가 같은 달에 여러 번 제출 */}
          {!loading && dupNames.length > 0 && (
            <div className="mx-4 mb-2 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2">
              <p className="text-xs text-red-300 font-semibold">
                ⚠️ 중복 {dupSet.size}곳 — 같은 거래처가 이 달에 여러 번 제출했어요
              </p>
              <p className="text-[11px] text-red-200/80 mt-0.5 leading-relaxed">
                {dupNames.join(', ')}
                <br />위쪽에 모아뒀어요. 비교 후 한 건만 남기고 나머지는 삭제하세요.
              </p>
            </div>
          )}

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
                  <div
                    key={r.id}
                    onClick={() => setSelectedId(r.id === selectedId ? null : r.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') setSelectedId(r.id === selectedId ? null : r.id); }}
                    className={`w-full text-left rounded-xl p-3 border transition-all cursor-pointer ${
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
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {isDup(r) && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded border bg-red-500/20 text-red-300 border-red-500/40 font-semibold">
                            중복 {dupCounts[normName(r.clinicName)]}
                          </span>
                        )}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${statusColor}`}>
                          {r.status}
                        </span>
                      </div>
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
                              className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                              style={{
                                backgroundColor: t?.bg,
                                color: t?.light,
                                border: `1px solid ${t?.color ?? '#fff'}40`,
                              }}
                            >
                              {chip.label}
                            </span>
                          );
                        })}
                        {totalTagCount > previewChips.length && (
                          <span className="text-[10px] text-gray-500">
                            +{totalTagCount - previewChips.length}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteRecord(r.id); }}
                        className="text-[10px] text-red-400 hover:text-red-300"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
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
              <p className="text-sm">좌측에서 치과를 선택하세요</p>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-6">
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

              {/* 중복 통합 안내 바 */}
              {isDup(selectedRecord) && (
                <div className="flex items-center justify-between gap-3 rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3">
                  <p className="text-sm text-red-200">
                    ⚠️ 이 거래처는{' '}
                    <b className="text-red-300">중복 {dupCounts[normName(selectedRecord.clinicName)]}건</b>
                    입니다. 빈 칸은 자동, 충돌만 골라 하나로 합칠 수 있어요.
                  </p>
                  <button
                    onClick={() =>
                      openMerge(
                        records.filter((r) => normName(r.clinicName) === normName(selectedRecord.clinicName))
                      )
                    }
                    className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-red-500/80 hover:bg-red-500 text-white text-sm font-semibold"
                  >
                    중복 통합
                  </button>
                </div>
              )}

              {/* 달력 */}
              <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
                <ScheduleCalendar record={selectedRecord} />
              </div>

              {/* 진료시간 — 태그별 시간 꼬리표 + 진료시간 속성 */}
              {(() => {
                const tagTimes = (Object.entries(selectedRecord.tagData) as [string, string][])
                  .map(([tag, ds]) => ({ tag, time: extractTagTime(ds) }))
                  .filter((t) => t.time);
                if (tagTimes.length === 0 && !selectedRecord.doctorTime) return null;
                return (
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <p className="text-xs text-cyan-300 font-semibold mb-3">진료시간</p>
                    {selectedRecord.doctorTime && (
                      <p className="text-sm text-gray-200 whitespace-pre-line mb-3">
                        {selectedRecord.doctorTime}
                      </p>
                    )}
                    {tagTimes.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {tagTimes.map(({ tag, time }) => {
                          const t = SCHEDULE_TAGS[tag as TagKey];
                          return (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
                              style={{
                                backgroundColor: t?.bg || '#333',
                                border: `1px solid ${t?.color ?? '#fff'}40`,
                              }}
                            >
                              <span style={{ color: t?.light || '#fff' }}>{tag}</span>
                              <span className="text-gray-100 font-semibold">{time}</span>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* 이벤트 */}
              {selectedRecord.events && (
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <p className="text-xs text-yellow-400 font-semibold mb-2">다음달 이벤트</p>
                  <p className="text-sm text-gray-200 whitespace-pre-line">{selectedRecord.events}</p>
                </div>
              )}

              {/* 휴진 사유 */}
              {selectedRecord.holidayReason && (
                <div className="bg-red-500/5 rounded-xl p-4 border border-red-500/20">
                  <p className="text-xs text-red-300 font-semibold mb-2">휴진 사유</p>
                  <p className="text-sm text-gray-200 whitespace-pre-line">{selectedRecord.holidayReason}</p>
                </div>
              )}

              {/* 달력에 꼭 표기할 내용 */}
              {selectedRecord.calendarText && (
                <div className="bg-blue-500/5 rounded-xl p-4 border border-blue-500/20">
                  <p className="text-xs text-blue-300 font-semibold mb-2">달력에 꼭 표기할 내용</p>
                  <p className="text-sm text-gray-200 whitespace-pre-line">{selectedRecord.calendarText}</p>
                </div>
              )}

              {/* 특이사항 / 병원 요청 */}
              {selectedRecord.specialNote && (
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <p className="text-xs text-gray-400 font-semibold mb-2">특이사항 / 병원 요청</p>
                  <p className="text-sm text-gray-200 whitespace-pre-line">{selectedRecord.specialNote}</p>
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

              {/* 관리자 설정 — 처리 상태 (변경DB '처리상태_폼') */}
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <p className="text-xs text-gray-400 font-semibold mb-2">처리 상태</p>
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
            </div>
          )}
        </main>
      </div>

      {/* 중복 통합 미리보기 모달 */}
      {mergeGroup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => { if (!merging) setMergeGroup(null); }}
        >
          <div
            className="w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-2xl bg-[#0f172a] border border-white/15 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-1">
              <h3 className="text-lg font-bold text-white">중복 통합 미리보기</h3>
              <button
                onClick={() => { if (!merging) setMergeGroup(null); }}
                className="text-2xl leading-none text-gray-400 hover:text-white"
              >
                ×
              </button>
            </div>
            <p className="text-sm text-gray-300">
              {mergeGroup[0].clinicName} · {mergeGroup.length}건 · {mergeGroup[0].targetMonth}
            </p>
            <p className="text-xs text-gray-500 mt-1 mb-4 leading-relaxed">
              빈 칸은 자동으로 합쳐집니다. <span className="text-amber-300 font-semibold">충돌(둘 다 다르게 입력)</span>만
              골라주세요. 확정하면 1건으로 합치고 나머지는 보관(노션 휴지통에서 복구 가능)됩니다.
            </p>

            <div className="space-y-2.5">
              {MERGE_FIELDS.map((f) => {
                const distinct = [
                  ...new Set(mergeGroup.map((r) => mergeFieldVal(r, f.key)).filter((v) => v.trim())),
                ];
                if (distinct.length === 0) return null;

                if (f.key === '출력사이즈') {
                  const union = [...new Set(mergeGroup.flatMap((r) => r.printSizes))];
                  return (
                    <div key={f.key} className="rounded-lg bg-white/5 border border-white/10 px-3 py-2">
                      <p className="text-xs text-gray-400">
                        {f.label} <span className="text-green-400">· 자동 합침</span>
                      </p>
                      <p className="text-sm text-gray-100 mt-0.5">{union.join(', ')}</p>
                    </div>
                  );
                }

                if (distinct.length === 1) {
                  return (
                    <div key={f.key} className="rounded-lg bg-white/5 border border-white/10 px-3 py-2">
                      <p className="text-xs text-gray-400">
                        {f.label} <span className="text-green-400">· 자동</span>
                      </p>
                      <p className="text-sm text-gray-100 mt-0.5 whitespace-pre-line">{distinct[0]}</p>
                    </div>
                  );
                }

                const joinVal = distinct.join(' / ');
                const options = [...distinct, joinVal];
                const current = mergeChoices[f.key] ?? distinct[0];
                return (
                  <div key={f.key} className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2">
                    <p className="text-xs text-amber-300 font-semibold mb-1.5">⚠️ {f.label} · 충돌 — 선택</p>
                    <div className="space-y-1">
                      {options.map((opt, oi) => {
                        const isJoin = opt === joinVal;
                        return (
                          <label
                            key={oi}
                            className={`flex items-start gap-2 rounded-md px-2 py-1.5 cursor-pointer border ${
                              current === opt ? 'bg-blue-600/20 border-blue-500/50' : 'border-white/10 hover:bg-white/5'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`merge-${f.key}`}
                              checked={current === opt}
                              onChange={() => setMergeChoices((c) => ({ ...c, [f.key]: opt }))}
                              className="mt-1 flex-shrink-0"
                            />
                            <span className="text-sm text-gray-100 whitespace-pre-line">
                              {isJoin && <span className="text-cyan-300 font-semibold">둘 다 합치기: </span>}
                              {opt}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setMergeGroup(null)}
                disabled={merging}
                className="flex-1 h-11 rounded-xl border border-white/15 text-gray-300 hover:bg-white/5 disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={confirmMerge}
                disabled={merging}
                className="flex-1 h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-50"
              >
                {merging ? '통합 중...' : '통합 확정'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
