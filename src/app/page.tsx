'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const MEETING_DB_URL = 'https://www.notion.so/f7b5f3e9ce2142599d0eedda716e588a';

export default function Home() {
  const router = useRouter();
  const [previousSubmissions, setPreviousSubmissions] = useState(() => {
    try { return !!localStorage.getItem('mediandmedi-last-submission'); }
    catch { return false; }
  });
  const [showChoice, setShowChoice] = useState(false);

  const handleNewClinic = () => {
    router.push('/new-clinic');
  };

  const handleStartMeeting = () => {
    window.location.href = MEETING_DB_URL;
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
              onClick={handleStartMeeting}
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
    </div>
  );
}
