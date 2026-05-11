'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
export default function Home() {
  const router = useRouter();
  const [previousSubmissions, setPreviousSubmissions] = useState(() => {
    try { return !!localStorage.getItem('mediandmedi-last-submission'); }
    catch { return false; }
  });
  const [showChoice, setShowChoice] = useState(false);
  const [meetingModalOpen, setMeetingModalOpen] = useState(false);
  const [clinics, setClinics] = useState<{ name: string; pageId: string }[]>([]);
  const [clinicsLoading, setClinicsLoading] = useState(false);
  const [clinicQuery, setClinicQuery] = useState('');
  const [creatingMeeting, setCreatingMeeting] = useState(false);

  const handleNewClinic = () => {
    router.push('/new-clinic');
  };

  useEffect(() => {
    if (!meetingModalOpen || clinics.length > 0 || clinicsLoading) return;
    setClinicsLoading(true);
    fetch('/api/clinic-list')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.clinics)) setClinics(data.clinics);
      })
      .catch(() => {})
      .finally(() => setClinicsLoading(false));
  }, [meetingModalOpen, clinics.length, clinicsLoading]);

  const filteredClinics = useMemo(() => {
    const q = clinicQuery.trim();
    if (!q) return clinics.slice(0, 50);
    return clinics
      .filter((c) => c.name.includes(q))
      .slice(0, 50);
  }, [clinics, clinicQuery]);

  const startMeetingWith = async (clinic?: { name: string; pageId: string }) => {
    if (creatingMeeting) return;
    setCreatingMeeting(true);
    try {
      const res = await fetch('/api/start-meeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          clinic ? { clinicName: clinic.name, clinicPageId: clinic.pageId } : {}
        ),
      });
      const data = await res.json();
      const target = data.url || data.fallbackUrl;
      if (target) {
        window.location.href = target;
      } else {
        alert('미팅 페이지를 만들지 못했어요. 다시 시도해 주세요.');
        setCreatingMeeting(false);
      }
    } catch {
      alert('네트워크 오류로 미팅 페이지를 만들지 못했어요.');
      setCreatingMeeting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC] px-6">
      <div className="w-full max-w-sm">
        {/* 로고 영역 */}
        <div className="text-center mb-12 animate-fade-in">
          <div className="w-16 h-16 bg-[#1E3A5F] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-white text-2xl font-bold">M</span>
          </div>
          <h1 className="text-2xl font-bold text-[#1E3A5F]">메디앤메디</h1>
          <p className="text-sm text-[#6B7280] mt-2">거래처 미팅 데이터 수집</p>
        </div>

        {/* 제출 후 재접속 시 선택지 */}
        {previousSubmissions && !showChoice ? (
          <div className="space-y-3 mb-8">
            <button
              onClick={() => {
                setShowChoice(true);
                setPreviousSubmissions(false);
              }}
              className="w-full h-14 bg-[#2563EB] text-white rounded-xl font-semibold text-base
                         hover:bg-[#1d4ed8] active:scale-[0.98] transition-all"
            >
              새 미팅 시작
            </button>
            <button
              onClick={() => {
                const lastId = localStorage.getItem('mediandmedi-last-submission');
                if (lastId) {
                  router.push(`/summary?id=${lastId}`);
                }
              }}
              className="w-full h-14 bg-white text-[#374151] border border-[#D1D5DB] rounded-xl
                         font-medium text-base hover:border-[#2563EB] hover:text-[#2563EB]
                         active:scale-[0.98] transition-all"
            >
              이전 제출 내역 보기
            </button>
          </div>
        ) : (
          <div className="space-y-4 animate-fade-in-delay">
            <button
              onClick={() => setMeetingModalOpen(true)}
              className="w-full h-14 bg-[#DC2626] text-white rounded-xl font-semibold text-base
                         hover:bg-[#b91c1c] active:scale-[0.98] transition-all
                         flex items-center justify-center gap-2 shadow-lg shadow-red-200"
            >
              <span className="relative flex items-center justify-center w-5 h-5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-40 animate-ping"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
              </span>
              미팅 녹음 시작
            </button>
            <button
              onClick={handleNewClinic}
              className="w-full h-14 bg-[#2563EB] text-white rounded-xl font-semibold text-base
                         hover:bg-[#1d4ed8] active:scale-[0.98] transition-all
                         flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              신규개원
            </button>
            <button
              onClick={() => router.push('/contract-change')}
              className="w-full h-14 bg-white text-[#374151] border border-[#D1D5DB] rounded-xl
                         font-medium text-base hover:border-[#2563EB] hover:text-[#2563EB]
                         active:scale-[0.98] transition-all
                         flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              계약변경
            </button>
            <button
              onClick={() => router.push('/schedule-change')}
              className="w-full h-14 bg-white text-[#374151] border border-[#D1D5DB] rounded-xl
                         font-medium text-base hover:border-[#2563EB] hover:text-[#2563EB]
                         active:scale-[0.98] transition-all
                         flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              진료일정 변경
            </button>
          </div>
        )}

        <p className="text-center text-xs text-[#9CA3AF] mt-8 animate-fade-in-delay-2">
          &copy; 메디앤메디 전략기획팀
        </p>
        <a href="/admin/schedule" className="text-xs text-gray-400 hover:text-gray-600 mt-4 block text-center">
          관리자 대시보드
        </a>
      </div>

      {/* 거래처 선택 모달 */}
      {meetingModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => !creatingMeeting && setMeetingModalOpen(false)}
        >
          <div
            className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-gray-100">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg font-bold text-[#1E3A5F]">미팅 시작 — 거래처 선택</h2>
                <button
                  onClick={() => !creatingMeeting && setMeetingModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl leading-none disabled:opacity-30"
                  disabled={creatingMeeting}
                  aria-label="닫기"
                >
                  ×
                </button>
              </div>
              <p className="text-xs text-gray-500">선택한 거래처명으로 노션 미팅 페이지가 만들어집니다.</p>
              <input
                autoFocus
                type="text"
                value={clinicQuery}
                onChange={(e) => setClinicQuery(e.target.value)}
                placeholder="거래처 검색 (치과명 일부)"
                className="mt-3 w-full h-11 px-3 border border-gray-200 rounded-lg text-sm
                           focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30 focus:border-[#DC2626]"
              />
            </div>

            <div className="flex-1 overflow-y-auto">
              {clinicsLoading ? (
                <div className="p-6 text-center text-sm text-gray-400">거래처 목록 불러오는 중...</div>
              ) : filteredClinics.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-400">
                  {clinicQuery ? '검색 결과가 없습니다.' : '거래처 목록이 비어 있습니다.'}
                </div>
              ) : (
                <ul>
                  {filteredClinics.map((c) => (
                    <li key={c.pageId}>
                      <button
                        onClick={() => startMeetingWith(c)}
                        disabled={creatingMeeting}
                        className="w-full text-left px-5 py-3 text-sm text-[#1E3A5F] border-b border-gray-50
                                   hover:bg-red-50 active:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed
                                   transition-colors"
                      >
                        {c.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 space-y-2">
              <button
                onClick={() => startMeetingWith(undefined)}
                disabled={creatingMeeting}
                className="w-full h-11 bg-white text-[#374151] border border-[#D1D5DB] rounded-lg
                           text-sm font-medium hover:border-[#DC2626] hover:text-[#DC2626]
                           disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {creatingMeeting ? '만드는 중...' : '거래처 없이 시작 (일반 미팅)'}
              </button>
              <p className="text-[11px] text-gray-400 text-center">
                선택 즉시 노션 페이지가 생성되고 자동으로 열립니다.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
