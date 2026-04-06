'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function SummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pageId, setPageId] = useState('');
  const [pin, setPin] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then(({ id }) => {
      setPageId(id);

      // PIN 확인
      const urlPin = searchParams.get('pin');
      const storedPin = localStorage.getItem(`mediandmedi-pin-${id}`);

      if (urlPin) {
        setPin(urlPin);
        setAuthenticated(true);
        localStorage.setItem(`mediandmedi-pin-${id}`, urlPin);
        fetchData(id);
      } else if (storedPin) {
        setPin(storedPin);
        setAuthenticated(true);
        fetchData(id);
      } else {
        setLoading(false);
      }
    });
  }, [params, searchParams]);

  const fetchData = async (id: string) => {
    try {
      const res = await fetch(`/api/summary/${id}`);
      if (res.ok) {
        const result = await res.json();
        setData(result.data);
      } else {
        setError('데이터를 불러올 수 없습니다');
      }
    } catch {
      setError('네트워크 오류');
    } finally {
      setLoading(false);
    }
  };

  const handlePinSubmit = () => {
    const storedPin = localStorage.getItem(`mediandmedi-pin-${pageId}`);
    if (pinInput === storedPin || pinInput === pin) {
      setAuthenticated(true);
      setLoading(true);
      fetchData(pageId);
    } else {
      setError('PIN이 일치하지 않습니다');
    }
  };

  const copyLink = () => {
    const url = `${window.location.origin}/summary/${pageId}`;
    navigator.clipboard.writeText(url).then(() => {
      alert('공유 링크가 복사되었습니다!');
    });
  };

  // PIN 입력 화면
  if (!authenticated && !loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-6">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-6">
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-[#1E3A5F] rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-[#374151]">PIN 입력</h2>
            <p className="text-sm text-[#6B7280] mt-1">제출 시 받은 4자리 PIN을 입력해주세요</p>
          </div>
          <input
            type="text"
            inputMode="numeric"
            maxLength={4}
            value={pinInput}
            onChange={(e) => {
              setPinInput(e.target.value.replace(/\D/g, ''));
              setError(null);
            }}
            placeholder="4자리 PIN"
            className="w-full h-14 px-4 text-center text-2xl font-bold tracking-[0.5em] rounded-lg border border-[#D1D5DB] focus:outline-none focus:border-[#2563EB]"
          />
          {error && <p className="text-sm text-[#DC2626] text-center mt-2">{error}</p>}
          <button
            onClick={handlePinSubmit}
            disabled={pinInput.length !== 4}
            className="w-full h-12 mt-4 bg-[#2563EB] text-white rounded-lg font-semibold
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            확인
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-[#E5E7EB] border-t-[#2563EB] animate-spin" />
      </div>
    );
  }

  // 노션 properties에서 데이터 추출
  const props = (data as { properties?: Record<string, unknown> })?.properties as Record<string, unknown> || {};
  const getTitle = (prop: unknown): string => {
    const p = prop as { title?: { plain_text: string }[] };
    return p?.title?.[0]?.plain_text || '';
  };
  const getRichText = (prop: unknown): string => {
    const p = prop as { rich_text?: { plain_text: string }[] };
    return p?.rich_text?.[0]?.plain_text || '';
  };
  const getMultiSelect = (prop: unknown): string[] => {
    const p = prop as { multi_select?: { name: string }[] };
    return p?.multi_select?.map((s) => s.name) || [];
  };
  const getSelect = (prop: unknown): string => {
    const p = prop as { select?: { name: string } };
    return p?.select?.name || '';
  };

  const clinicName = getTitle(props['title']) || getTitle(props['치과명']);

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="bg-white border-b border-[#E5E7EB]">
        <div className="max-w-lg mx-auto flex items-center justify-between px-6 py-4">
          <button
            onClick={() => router.push('/')}
            className="w-10 h-10 flex items-center justify-center min-w-[44px] min-h-[44px]"
          >
            <svg className="w-5 h-5 text-[#374151]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-base font-semibold text-[#374151]">제출 완료</h2>
          <div className="w-10" />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-6 py-6 space-y-6">
        {/* 성공 카드 */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[#16A34A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-[#374151] mb-1">
            {clinicName || '거래처'} 정보가 저장되었습니다
          </h2>
          <p className="text-sm text-[#6B7280]">
            팀별 업무가 자동으로 생성되었습니다
          </p>
        </div>

        {/* 요약 정보 */}
        {data && (
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 space-y-3">
            <h3 className="text-sm font-semibold text-[#374151]">요약</h3>
            {getRichText(props['원장명']) && (
              <InfoRow label="원장명" value={getRichText(props['원장명'])} />
            )}
            {getSelect(props['지역(시도)']) && (
              <InfoRow label="지역" value={`${getSelect(props['지역(시도)'])} ${getSelect(props['지역(구군)'])}`} />
            )}
            {getMultiSelect(props['진료과목']).length > 0 && (
              <InfoRow label="진료과목" value={getMultiSelect(props['진료과목']).join(', ')} />
            )}
            {getMultiSelect(props['주력진료']).length > 0 && (
              <InfoRow label="주력진료" value={getMultiSelect(props['주력진료']).join(', ')} />
            )}
            {getSelect(props['예산범위']) && (
              <InfoRow label="예산" value={getSelect(props['예산범위'])} />
            )}
          </div>
        )}

        {/* 액션 버튼 */}
        <div className="space-y-3">
          <button
            onClick={copyLink}
            className="w-full h-12 bg-[#2563EB] text-white rounded-lg font-semibold flex items-center justify-center gap-2
                       hover:bg-[#1d4ed8] active:scale-[0.98] transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
            </svg>
            공유 링크 복사
          </button>
          <button
            onClick={() => router.push('/')}
            className="w-full h-12 bg-white text-[#374151] border border-[#D1D5DB] rounded-lg font-medium
                       hover:border-[#2563EB] hover:text-[#2563EB] transition-all"
          >
            홈으로 돌아가기
          </button>
        </div>

        <p className="text-center text-xs text-[#9CA3AF]">
          PIN: {pin} (이 PIN으로 다시 접근할 수 있습니다)
        </p>
      </main>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex text-sm">
      <span className="w-20 flex-shrink-0 text-[#9CA3AF]">{label}</span>
      <span className="text-[#374151]">{value}</span>
    </div>
  );
}
