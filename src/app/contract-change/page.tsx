'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ChipSelector from '@/components/ChipSelector';
import LoadingOverlay from '@/components/LoadingOverlay';
import { SERVICES } from '@/data/services';

const SERVICE_NAMES = SERVICES.map((s) => s.name);

export default function ContractChangePage() {
  const router = useRouter();
  const [clinicName, setClinicName] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [currentServices, setCurrentServices] = useState<string[]>([]);
  const [addServices, setAddServices] = useState<string[]>([]);
  const [removeServices, setRemoveServices] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!clinicName || !doctorName || currentServices.length === 0 || !reason) {
      setError('필수 항목을 모두 입력해주세요 (치과명, 원장명, 현재 상품, 변경 사유)');
      return;
    }

    setSubmitting(true);
    setSubmitStep(0);
    setError(null);

    try {
      const response = await fetch('/api/change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicName,
          doctorName,
          currentServices,
          addServices,
          removeServices,
          reason,
        }),
      });

      setSubmitStep(1);

      if (!response.ok) throw new Error('제출 실패');

      setSubmitStep(2);
      await new Promise((r) => setTimeout(r, 1500));

      // 완료 알림 후 메인으로
      alert(`${clinicName} 계약변경이 저장되었습니다.`);
      router.push('/');
    } catch (err) {
      setSubmitting(false);
      setError(err instanceof Error ? err.message : '저장 실패');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      <LoadingOverlay
        show={submitting}
        steps={['계약변경 정보 저장 중...', '완료!']}
        currentStepIndex={submitStep}
      />

      <header className="bg-white border-b border-[#E5E7EB] sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center justify-between px-6 py-4">
          <button
            onClick={() => router.push('/')}
            className="w-10 h-10 flex items-center justify-center min-w-[44px] min-h-[44px]"
          >
            <svg className="w-5 h-5 text-[#374151]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-base font-semibold text-[#374151]">계약변경</h2>
          <div className="w-10" />
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-6 py-6 pb-28 space-y-6">
        <div>
          <label className="block text-sm font-semibold text-[#374151] mb-2">
            치과명 <span className="text-[#DC2626]">*</span>
          </label>
          <input
            value={clinicName}
            onChange={(e) => setClinicName(e.target.value)}
            placeholder="예: OO치과의원"
            className="w-full h-12 px-4 rounded-lg border border-[#D1D5DB] text-base focus:outline-none focus:border-[#2563EB]"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#374151] mb-2">
            원장님 성함 <span className="text-[#DC2626]">*</span>
          </label>
          <input
            value={doctorName}
            onChange={(e) => setDoctorName(e.target.value)}
            placeholder="예: 홍길동"
            className="w-full h-12 px-4 rounded-lg border border-[#D1D5DB] text-base focus:outline-none focus:border-[#2563EB]"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#374151] mb-2">
            현재 계약 상품 <span className="text-[#DC2626]">*</span>
          </label>
          <ChipSelector
            options={SERVICE_NAMES}
            selected={currentServices}
            onChange={setCurrentServices}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#374151] mb-2">
            추가할 상품
          </label>
          <ChipSelector
            options={SERVICE_NAMES.filter((s) => !currentServices.includes(s))}
            selected={addServices}
            onChange={setAddServices}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#374151] mb-2">
            축소/해지할 상품
          </label>
          <ChipSelector
            options={currentServices}
            selected={removeServices}
            onChange={setRemoveServices}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#374151] mb-2">
            변경 사유 <span className="text-[#DC2626]">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="계약 변경 사유를 작성해주세요"
            rows={4}
            className="w-full px-4 py-3 rounded-lg border border-[#D1D5DB] text-base focus:outline-none focus:border-[#2563EB] resize-none"
          />
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
        <div className="max-w-lg mx-auto px-6 py-4">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full h-12 bg-[#2563EB] text-white rounded-lg font-semibold
                       hover:bg-[#1d4ed8] active:scale-[0.98] transition-all
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            제출하기
          </button>
          {error && (
            <p className="text-sm text-[#DC2626] text-center mt-2">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
