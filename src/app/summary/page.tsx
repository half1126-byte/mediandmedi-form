'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SERVICES } from '@/data/services';

function SummaryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pin, setPin] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pageId, setPageId] = useState('');
  const [showPin, setShowPin] = useState(false);

  useEffect(() => {
    const id = searchParams.get('id') || '';
    setPageId(id);

    if (!id) {
      setLoading(false);
      setError('ID가 없습니다');
      return;
    }

    const urlPin = searchParams.get('pin');
    const storedPin = localStorage.getItem(`mediandmedi-pin-${id}`);

    if (urlPin) {
      setPin(urlPin);
      setAuthenticated(true);
      localStorage.setItem(`mediandmedi-pin-${id}`, urlPin);
      loadData(id);
    } else if (storedPin) {
      setPin(storedPin);
      setAuthenticated(true);
      loadData(id);
    } else {
      setLoading(false);
    }
  }, [searchParams]);

  const loadData = (id: string) => {
    try {
      const stored = localStorage.getItem(`mediandmedi-submitted-${id}`);
      if (stored) {
        setData(JSON.parse(stored));
      }
    } catch {
      setError('데이터를 불러올 수 없습니다');
    } finally {
      setLoading(false);
    }
  };

  const handlePinSubmit = () => {
    const storedPin = localStorage.getItem(`mediandmedi-pin-${pageId}`);
    if (pinInput === storedPin || pinInput === pin) {
      setAuthenticated(true);
      setLoading(true);
      loadData(pageId);
    } else {
      setError('PIN이 일치하지 않습니다');
    }
  };

  const copyLink = () => {
    const url = `${window.location.origin}/summary?id=${pageId}`;
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
            <p className="text-sm text-[#6B7280] mt-1">제출 시 받은 4자리 PIN을 입력해 주세요</p>
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

  const formData = data as Record<string, Record<string, unknown>> | null;
  const step1 = (formData?.step1 || {}) as Record<string, unknown>;
  const step2 = (formData?.step2 || {}) as Record<string, unknown>;
  const step3 = (formData?.step3 || {}) as Record<string, unknown>;
  const step4 = (formData?.step4 || {}) as Record<string, unknown>;
  const step5 = (formData?.step5 || {}) as Record<string, unknown>;
  const step6 = (formData?.step6 || {}) as Record<string, unknown>;
  const region = (step1.region || {}) as Record<string, string>;
  const parking = (step3.parking || {}) as Record<string, string>;
  const clinicName = (step1.clinicName as string) || '거래처';
  const services = (step6.services || []) as { serviceId: string; quantity?: number }[];

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="bg-white border-b border-[#E5E7EB]">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-6 py-4">
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

      <main className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[#16A34A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-[#374151] mb-1">
            {clinicName} 정보가 저장되었습니다
          </h2>
          <p className="text-sm text-[#6B7280]">
            팀별 업무가 자동으로 생성되었습니다
          </p>
        </div>

        {data && (
          <div className="space-y-4">
            <SummarySection title="기본 정보">
              <InfoRow label="원장명" value={step1.doctorName as string} />
              <InfoRow label="개원예정일" value={step1.openDate as string} />
              {region.city && <InfoRow label="지역" value={`${region.city} ${region.district || ''}`} />}
              <InfoRow label="주소" value={step1.address as string} />
            </SummarySection>

            <SummarySection title="진료 정보">
              <InfoRow label="진료과목" value={((step2.dentalSubjects as string[]) || []).join(', ')} />
              <InfoRow label="주력진료" value={((step2.topSubjects as string[]) || []).join(', ')} />
              <InfoRow label="공휴일" value={(step2.holidayClose as boolean) ? '휴진' : '진료'} />
            </SummarySection>

            <SummarySection title="시설/장비">
              <InfoRow label="체어 수" value={step3.chairs ? `${step3.chairs}대` : ''} />
              <InfoRow label="장비" value={((step3.equipment as string[]) || []).join(', ')} />
              <InfoRow label="시설" value={((step3.facilities as string[]) || []).join(', ')} />
              <InfoRow label="주차" value={parking.detail ? `${parking.available} (${parking.detail})` : parking.available} />
              <InfoRow label="인테리어" value={step3.interiorStyle as string} />
            </SummarySection>

            <SummarySection title="브랜딩 & 철학">
              <InfoRow label="한줄소개" value={step4.oneLiner as string} />
              <InfoRow label="타겟환자" value={step4.targetPatients as string} />
              <InfoRow label="차별점" value={step4.differentiator as string} />
            </SummarySection>

            <SummarySection title="마케팅 방향">
              <InfoRow label="예산" value={step5.budgetRange as string} />
              <InfoRow label="목표" value={((step5.marketingGoals as string[]) || []).join(', ')} />
              <InfoRow label="채널" value={((step5.desiredChannels as string[]) || []).join(', ')} />
            </SummarySection>

            {services.length > 0 && (
              <SummarySection title="계약 상품">
                <InfoRow label="서비스" value={services.map((s) => {
                  const svc = SERVICES.find((sv) => sv.id === s.serviceId);
                  return svc ? (s.quantity ? `${svc.name} ${s.quantity}${svc.unit}` : svc.name) : s.serviceId;
                }).join(', ')} />
                <InfoRow label="패키지" value={(step6.isStarterPackage as boolean) ? '초기개원 패키지' : '일반'} />
                <InfoRow label="월계약금" value={step6.monthlyFee as string} />
              </SummarySection>
            )}
          </div>
        )}

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
            처음으로 돌아가기
          </button>
        </div>

        <button
          onClick={() => setShowPin(!showPin)}
          className="w-full text-center text-xs text-[#9CA3AF] py-2"
        >
          {showPin ? `PIN: ${pin}` : 'PIN 보기 (탭하세요)'}
        </button>
      </main>
    </div>
  );
}

export default function SummaryPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-[#E5E7EB] border-t-[#2563EB] animate-spin" />
      </div>
    }>
      <SummaryContent />
    </Suspense>
  );
}

function SummarySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 space-y-2">
      <h3 className="text-sm font-semibold text-[#374151]">{title}</h3>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  if (!value || !value.trim()) return null;
  return (
    <div className="flex text-sm">
      <span className="w-20 flex-shrink-0 text-[#9CA3AF]">{label}</span>
      <span className="text-[#374151]">{value}</span>
    </div>
  );
}
