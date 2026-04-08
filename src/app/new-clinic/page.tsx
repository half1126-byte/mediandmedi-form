'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ProgressBar from '@/components/ProgressBar';
import ChipSelector from '@/components/ChipSelector';
import CategoryChipSelector from '@/components/CategoryChipSelector';
import TimeSelector from '@/components/TimeSelector';
import RegionCascade from '@/components/RegionCascade';
import ContractProducts from '@/components/ContractProducts';
import LoadingOverlay from '@/components/LoadingOverlay';
import RestoreDialog from '@/components/RestoreDialog';
import {
  generateSessionId,
  useAutosave,
  findExistingSaves,
  loadForm,
  clearForm,
  type SavedFormData,
} from '@/lib/autosave';
import { SERVICES as SERVICES_LIST } from '@/data/services';
import {
  DENTAL_CATEGORIES,
  EQUIPMENT_LIST,
  FACILITY_LIST,
  MARKETING_CHANNELS,
  REFERRAL_SOURCES,
  BUDGET_RANGES,
  WEEKDAYS,
} from '@/data/dental';

const STEP_LABELS = [
  '기본 정보',
  '진료 정보',
  '시설/장비',
  '브랜딩 & 철학',
  '마케팅 방향',
  '계약 상품',
  '최종 확인',
];
const TOTAL_STEPS = 7;

const DEFAULT_SCHEDULE: Record<string, { enabled: boolean; start: string; end: string }> = {};
WEEKDAYS.forEach((day) => {
  DEFAULT_SCHEDULE[day] = {
    enabled: day !== '일',
    start: '09:00',
    end: day === '토' ? '13:00' : '18:00',
  };
});

interface FormData {
  step1: {
    clinicName: string;
    doctorName: string;
    openDate: string;
    region: { city: string; district: string; dong?: string };
    address: string;
    phone: string;
    fax: string;
    softOpenDate: string;
    interiorCompleteDate: string;
    photoDate: string;
    doctorCount: number;
  };
  step2: {
    dentalSubjects: string[];
    topSubjects: string[];
    schedule: Record<string, { enabled: boolean; start: string; end: string }>;
    holidays: string[];
    holidayClose: boolean;
    lunchTime: { start: string; end: string };
    nightWeekend: string;
  };
  step3: {
    chairs: number;
    equipment: string[];
    facilities: string[];
    parking: { available: string; detail: string };
    interiorStyle: string;
    implantBrands: string[];
    hasLabRoom: boolean;
    labEquipment: string[];
  };
  step4: {
    oneLiner: string;
    philosophy: string;
    targetPatients: string;
    differentiator: string;
    doctorCareer: string;
    hasProfilePhoto: boolean;
    additionalDoctors: { name: string; title: string; specialty: string }[];
  };
  step5: {
    referralSource: string[];
    previousMarketing: string;
    budgetRange: string;
    marketingGoals: string[];
    desiredChannels: string[];
    additionalRequest: string;
    benchmarkClinics: string;
    openingEvent: string;
  };
  step6: {
    services: { serviceId: string; quantity?: number }[];
    isStarterPackage: boolean;
    contractStartDate: string;
    monthlyFee: string;
    specialNotes: string;
    didCount: number;
    didInfo: string;
  };
}

const INITIAL_DATA: FormData = {
  step1: { clinicName: '', doctorName: '', openDate: '', region: { city: '', district: '' }, address: '', phone: '', fax: '', softOpenDate: '', interiorCompleteDate: '', photoDate: '', doctorCount: 1 },
  step2: {
    dentalSubjects: [], topSubjects: [], schedule: DEFAULT_SCHEDULE,
    holidays: [], holidayClose: true, lunchTime: { start: '12:30', end: '13:30' }, nightWeekend: '',
  },
  step3: { chairs: 5, equipment: [], facilities: [], parking: { available: '가능', detail: '' }, interiorStyle: '', implantBrands: [], hasLabRoom: false, labEquipment: [] },
  step4: { oneLiner: '', philosophy: '', targetPatients: '', differentiator: '', doctorCareer: '', hasProfilePhoto: false, additionalDoctors: [] },
  step5: { referralSource: [], previousMarketing: '', budgetRange: '', marketingGoals: [], desiredChannels: [], additionalRequest: '', benchmarkClinics: '', openingEvent: '' },
  step6: { services: [], isStarterPackage: false, contractStartDate: '', monthlyFee: '', specialNotes: '', didCount: 0, didInfo: '' },
};

export default function NewClinicPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<FormData>(INITIAL_DATA);
  const [sessionId, setSessionId] = useState('');
  const [showRestore, setShowRestore] = useState<SavedFormData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // 초기화: 기존 저장 확인
  useEffect(() => {
    const saves = findExistingSaves();
    if (saves.length > 0) {
      setShowRestore(saves[0]);
    } else {
      setSessionId(generateSessionId());
    }
  }, []);

  const handleRestore = () => {
    if (!showRestore) return;
    const loaded = loadForm(showRestore.sessionId);
    if (loaded) {
      setSessionId(showRestore.sessionId);
      setData(loaded.data as unknown as FormData);
      setStep(loaded.currentStep);
    }
    setShowRestore(null);
  };

  const handleNewStart = () => {
    if (showRestore) {
      clearForm(showRestore.sessionId);
    }
    setSessionId(generateSessionId());
    setShowRestore(null);
  };

  const getAutosaveData = useCallback((): SavedFormData => ({
    sessionId,
    clinicName: data.step1.clinicName,
    currentStep: step,
    totalSteps: TOTAL_STEPS,
    data: data as unknown as Record<string, unknown>,
    savedAt: new Date().toISOString(),
  }), [sessionId, data, step]);

  const { saveNow } = useAutosave(
    sessionId,
    getAutosaveData,
    [data, step]
  );

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const nextStep = () => {
    saveNow();
    if (step < TOTAL_STEPS - 1) {
      setStep(step + 1);
      scrollToTop();
    }
  };

  const prevStep = () => {
    saveNow();
    if (step > 0) {
      setStep(step - 1);
      scrollToTop();
    }
  };

  const goToStep = (s: number) => {
    saveNow();
    setStep(s);
    scrollToTop();
  };

  const updateStep = <K extends keyof FormData>(
    key: K,
    updates: Partial<FormData[K]>
  ) => {
    setData((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...updates },
    }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitStep(0);
    setSubmitError(null);

    try {
      const pin = String(Math.floor(1000 + Math.random() * 9000));

      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, pin }),
      });

      setSubmitStep(1);
      if (!response.ok) throw new Error('제출 실패');

      const result = await response.json();
      const pageId = result.pageId;

      // 요약 페이지용 데이터를 localStorage에 저장
      localStorage.setItem(`mediandmedi-submitted-${pageId}`, JSON.stringify(data));

      setSubmitStep(2);

      clearForm(sessionId);
      localStorage.setItem('mediandmedi-last-submission', pageId);
      localStorage.setItem(`mediandmedi-pin-${pageId}`, pin);

      await new Promise((r) => setTimeout(r, 1500));
      router.push(`/summary?id=${pageId}&pin=${pin}`);
    } catch (error) {
      setSubmitting(false);
      setRetryCount((c) => c + 1);
      setSubmitError(
        error instanceof Error ? error.message : '저장 실패, 데이터는 기기에 보관 중입니다.'
      );
    }
  };

  // 복원 다이얼로그
  if (showRestore) {
    return (
      <RestoreDialog
        savedData={showRestore}
        onRestore={handleRestore}
        onNew={handleNewStart}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      <LoadingOverlay
        show={submitting}
        steps={['거래처 정보 저장 중...', '팀별 업무 생성 중...', '완료!']}
        currentStepIndex={submitStep}
      />

      {/* 상단 헤더 */}
      <header className="bg-white border-b border-[#E5E7EB] sticky top-0 z-10">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between px-6 py-3">
            <button
              onClick={() => step === 0 ? router.push('/') : prevStep()}
              className="w-10 h-10 flex items-center justify-center min-w-[44px] min-h-[44px]"
            >
              <svg className="w-5 h-5 text-[#374151]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-base font-semibold text-[#374151]">신규개원</h2>
            <div className="w-10" />
          </div>
          <ProgressBar
            currentStep={step}
            totalSteps={TOTAL_STEPS}
            stepLabels={STEP_LABELS}
          />
        </div>
      </header>

      {/* 폼 콘텐츠 */}
      <main className="flex-1 max-w-lg mx-auto w-full px-6 py-6 pb-28">
        <div key={step} className="animate-fade-slide-in">
          {step === 0 && <Step1 data={data.step1} onChange={(u) => updateStep('step1', u)} />}
          {step === 1 && <Step2 data={data.step2} onChange={(u) => updateStep('step2', u)} />}
          {step === 2 && <Step3 data={data.step3} onChange={(u) => updateStep('step3', u)} />}
          {step === 3 && <Step4 data={data.step4} onChange={(u) => updateStep('step4', u)} />}
          {step === 4 && <Step5 data={data.step5} onChange={(u) => updateStep('step5', u)} />}
          {step === 5 && <Step6 data={data.step6} onChange={(u) => updateStep('step6', u)} />}
          {step === 6 && <Step7 data={data} onGoToStep={goToStep} />}
        </div>
      </main>

      {/* 하단 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
        <div className="max-w-lg mx-auto px-6 py-4 flex gap-3">
          {step > 0 && step < 6 && (
            <button
              onClick={prevStep}
              className="h-12 px-6 bg-white border border-[#D1D5DB] text-[#374151] rounded-lg font-medium"
            >
              이전
            </button>
          )}
          {step < 6 ? (
            <button
              onClick={nextStep}
              disabled={
                (step === 0 && (!data.step1.clinicName || !data.step1.doctorName || !data.step1.openDate || !data.step1.region.city || !data.step1.region.district)) ||
                (step === 1 && data.step2.dentalSubjects.length === 0)
              }
              className="flex-1 h-12 bg-[#2563EB] text-white rounded-lg font-semibold
                         hover:bg-[#1d4ed8] active:scale-[0.98] transition-all
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              다음
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 h-12 bg-[#2563EB] text-white rounded-lg font-semibold
                         hover:bg-[#1d4ed8] active:scale-[0.98] transition-all
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              제출하기
            </button>
          )}
        </div>
        {submitError && (
          <div className="max-w-lg mx-auto px-6 pb-4">
            <div className="bg-red-50 text-[#DC2626] text-sm p-3 rounded-lg flex items-center justify-between">
              <span>{submitError}</span>
              <button
                onClick={handleSubmit}
                className="text-[#DC2626] font-semibold underline ml-2"
              >
                다시 시도 {retryCount > 0 && `(${retryCount})`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============= Step Components =============

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-semibold text-[#374151] mb-2">
      {children}
      {required && <span className="text-[#DC2626] ml-1">*</span>}
    </label>
  );
}

function TextInput({
  value, onChange, placeholder, type = 'text',
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full h-12 px-4 rounded-lg border border-[#D1D5DB] text-base text-[#374151]
                 placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
    />
  );
}

function TextArea({
  value, onChange, placeholder, rows = 3,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-4 py-3 rounded-lg border border-[#D1D5DB] text-base text-[#374151]
                 placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] resize-none"
    />
  );
}

// Step 1: 기본 정보
function Step1({
  data, onChange,
}: {
  data: FormData['step1'];
  onChange: (u: Partial<FormData['step1']>) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <FieldLabel required>치과명</FieldLabel>
        <TextInput value={data.clinicName} onChange={(v) => onChange({ clinicName: v })} placeholder="예: OO치과의원" />
      </div>
      <div>
        <FieldLabel required>원장님 성함</FieldLabel>
        <TextInput value={data.doctorName} onChange={(v) => onChange({ doctorName: v })} placeholder="예: 홍길동" />
      </div>
      <div>
        <FieldLabel required>개원예정일</FieldLabel>
        <TextInput type="date" value={data.openDate} onChange={(v) => onChange({ openDate: v })} />
      </div>
      <div>
        <FieldLabel required>지역</FieldLabel>
        <RegionCascade value={data.region} onChange={(v) => onChange({ region: v })} />
      </div>
      <div>
        <FieldLabel>상세 주소</FieldLabel>
        <TextInput value={data.address} onChange={(v) => onChange({ address: v })} placeholder="예: OO빌딩 3층" />
      </div>
      <div>
        <FieldLabel>대표전화</FieldLabel>
        <TextInput value={data.phone} onChange={(v) => onChange({ phone: v })} placeholder="예: 02-1234-5678" />
      </div>
      <div>
        <FieldLabel>팩스번호</FieldLabel>
        <TextInput value={data.fax} onChange={(v) => onChange({ fax: v })} placeholder="예: 02-1234-5679" />
      </div>
      <div>
        <FieldLabel>가오픈 예정일</FieldLabel>
        <TextInput type="date" value={data.softOpenDate} onChange={(v) => onChange({ softOpenDate: v })} />
      </div>
      <div>
        <FieldLabel>인테리어 완료 예정일</FieldLabel>
        <TextInput type="date" value={data.interiorCompleteDate} onChange={(v) => onChange({ interiorCompleteDate: v })} />
      </div>
      <div>
        <FieldLabel>사진 촬영 가능 날짜</FieldLabel>
        <TextInput type="date" value={data.photoDate} onChange={(v) => onChange({ photoDate: v })} />
      </div>
      <div>
        <FieldLabel>총 의료진 수</FieldLabel>
        <p className="text-xs text-[#6B7280] mb-3">원장 포함 전체 의료진 인원</p>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => onChange({ doctorCount: Math.max(1, (data.doctorCount || 1) - 1) })}
            className="w-10 h-10 rounded-full border border-[#D1D5DB] text-[#374151] text-xl font-light flex items-center justify-center hover:border-[#2563EB] hover:text-[#2563EB] transition-colors"
          >−</button>
          <span className="text-2xl font-bold text-[#2563EB] w-16 text-center">
            {data.doctorCount || 1}명
          </span>
          <button
            type="button"
            onClick={() => onChange({ doctorCount: (data.doctorCount || 1) + 1 })}
            className="w-10 h-10 rounded-full border border-[#D1D5DB] text-[#374151] text-xl font-light flex items-center justify-center hover:border-[#2563EB] hover:text-[#2563EB] transition-colors"
          >+</button>
        </div>
      </div>
    </div>
  );
}

// Step 2: 진료 정보
function Step2({
  data, onChange,
}: {
  data: FormData['step2'];
  onChange: (u: Partial<FormData['step2']>) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <FieldLabel required>진료과목</FieldLabel>
        <p className="text-xs text-[#6B7280] mb-3">해당하는 진료과목을 모두 선택해주세요</p>
        <CategoryChipSelector
          categories={DENTAL_CATEGORIES}
          selected={data.dentalSubjects}
          onChange={(v) => onChange({ dentalSubjects: v })}
        />
      </div>
      {data.dentalSubjects.length > 0 && (
        <div>
          <FieldLabel>주력진료 TOP 3</FieldLabel>
          <p className="text-xs text-[#6B7280] mb-3">선택한 과목 중 주력으로 마케팅할 과목 (최대 3개)</p>
          <ChipSelector
            options={data.dentalSubjects}
            selected={data.topSubjects}
            onChange={(v) => onChange({ topSubjects: v })}
            max={3}
          />
        </div>
      )}
      <div>
        <FieldLabel>진료시간</FieldLabel>
        <TimeSelector
          schedule={data.schedule}
          onChange={(v) => onChange({ schedule: v })}
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange({ holidayClose: !data.holidayClose })}
          className={`w-12 h-7 rounded-full transition-all flex-shrink-0 ${
            data.holidayClose ? 'bg-[#2563EB]' : 'bg-[#D1D5DB]'
          }`}
        >
          <div
            className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform mx-1 ${
              data.holidayClose ? 'translate-x-5' : ''
            }`}
          />
        </button>
        <span className="text-sm text-[#374151]">공휴일 휴진</span>
      </div>
      <div>
        <FieldLabel>점심시간</FieldLabel>
        <div className="flex items-center gap-2">
          <select
            value={data.lunchTime.start}
            onChange={(e) => onChange({ lunchTime: { ...data.lunchTime, start: e.target.value } })}
            className="flex-1 h-12 px-4 rounded-lg border border-[#D1D5DB] text-base"
          >
            {['12:00', '12:30', '13:00'].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <span className="text-[#9CA3AF]">~</span>
          <select
            value={data.lunchTime.end}
            onChange={(e) => onChange({ lunchTime: { ...data.lunchTime, end: e.target.value } })}
            className="flex-1 h-12 px-4 rounded-lg border border-[#D1D5DB] text-base"
          >
            {['13:00', '13:30', '14:00', '14:30'].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <FieldLabel>야간/주말 진료 특이사항</FieldLabel>
        <TextInput
          value={data.nightWeekend}
          onChange={(v) => onChange({ nightWeekend: v })}
          placeholder="예: 수요일 야간진료 21시까지"
        />
      </div>
    </div>
  );
}

// Step 3: 시설/장비
function Step3({
  data, onChange,
}: {
  data: FormData['step3'];
  onChange: (u: Partial<FormData['step3']>) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <FieldLabel>체어 수</FieldLabel>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={1}
            max={30}
            value={data.chairs}
            onChange={(e) => onChange({ chairs: parseInt(e.target.value) })}
            className="flex-1 accent-[#2563EB]"
          />
          <span className="text-lg font-semibold text-[#2563EB] w-12 text-center">
            {data.chairs}대
          </span>
        </div>
      </div>
      <div>
        <FieldLabel>보유 장비</FieldLabel>
        <ChipSelector
          options={EQUIPMENT_LIST}
          selected={data.equipment}
          onChange={(v) => onChange({ equipment: v })}
        />
      </div>
      <div>
        <FieldLabel>시설</FieldLabel>
        <ChipSelector
          options={FACILITY_LIST}
          selected={data.facilities}
          onChange={(v) => onChange({ facilities: v })}
        />
      </div>
      <div>
        <FieldLabel>주차</FieldLabel>
        <ChipSelector
          options={['가능', '불가', '발렛', '기타']}
          selected={[data.parking.available]}
          onChange={(v) => onChange({ parking: { ...data.parking, available: v[0] || '가능' } })}
          multiple={false}
        />
        {data.parking.available === '기타' && (
          <div className="mt-2">
            <TextInput
              value={data.parking.detail}
              onChange={(v) => onChange({ parking: { ...data.parking, detail: v } })}
              placeholder="주차 관련 상세 내용"
            />
          </div>
        )}
      </div>
      <div>
        <FieldLabel>인테리어 컨셉/스타일</FieldLabel>
        <TextInput
          value={data.interiorStyle}
          onChange={(v) => onChange({ interiorStyle: v })}
          placeholder="예: 모던, 따뜻한 우드톤, 아이 친화적"
        />
      </div>
      <div>
        <FieldLabel>임플란트 제품사</FieldLabel>
        <ChipSelector
          options={['오스템', '메가젠', '스트라우만', '덴티움', '네오', '디오', '코웰']}
          selected={data.implantBrands}
          onChange={(v) => onChange({ implantBrands: v })}
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange({ hasLabRoom: !data.hasLabRoom })}
          className={`w-12 h-7 rounded-full transition-all flex-shrink-0 ${
            data.hasLabRoom ? 'bg-[#2563EB]' : 'bg-[#D1D5DB]'
          }`}
        >
          <div
            className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform mx-1 ${
              data.hasLabRoom ? 'translate-x-5' : ''
            }`}
          />
        </button>
        <span className="text-sm text-[#374151]">기공소 보유</span>
      </div>
      {data.hasLabRoom && (
        <div>
          <FieldLabel>기공소 장비</FieldLabel>
          <ChipSelector
            options={['밀링머신', '포세린퍼니스', '신터링기', '모델스캐너']}
            selected={data.labEquipment}
            onChange={(v) => onChange({ labEquipment: v })}
          />
        </div>
      )}
    </div>
  );
}

// Step 4: 브랜딩 & 철학
function Step4({
  data, onChange,
}: {
  data: FormData['step4'];
  onChange: (u: Partial<FormData['step4']>) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <FieldLabel>치과 한줄 소개</FieldLabel>
        <TextArea
          value={data.oneLiner}
          onChange={(v) => onChange({ oneLiner: v })}
          placeholder="예: 환자 한 명 한 명에게 충분한 시간을 드리는 치과"
          rows={2}
        />
      </div>
      <div>
        <FieldLabel>진료 철학</FieldLabel>
        <TextArea
          value={data.philosophy}
          onChange={(v) => onChange({ philosophy: v })}
          placeholder="예: 과잉진료 없이 꼭 필요한 치료만, 투명한 설명과 합리적인 비용"
          rows={3}
        />
      </div>
      <div>
        <FieldLabel>타겟 환자층</FieldLabel>
        <TextInput
          value={data.targetPatients}
          onChange={(v) => onChange({ targetPatients: v })}
          placeholder="예: 30~50대 직장인, 교정 관심 20대"
        />
      </div>
      <div>
        <FieldLabel>차별점 / 강점</FieldLabel>
        <TextArea
          value={data.differentiator}
          onChange={(v) => onChange({ differentiator: v })}
          placeholder="예: 연세대 출신 보철 전문의, 디지털 임플란트 도입"
          rows={3}
        />
      </div>
      <div>
        <FieldLabel>원장님 경력</FieldLabel>
        <TextArea
          value={data.doctorCareer}
          onChange={(v) => onChange({ doctorCareer: v })}
          placeholder="예: 서울대 치의학 박사, 분당서울대병원 수련"
          rows={3}
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange({ hasProfilePhoto: !data.hasProfilePhoto })}
          className={`w-12 h-7 rounded-full transition-all flex-shrink-0 ${
            data.hasProfilePhoto ? 'bg-[#2563EB]' : 'bg-[#D1D5DB]'
          }`}
        >
          <div
            className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform mx-1 ${
              data.hasProfilePhoto ? 'translate-x-5' : ''
            }`}
          />
        </button>
        <span className="text-sm text-[#374151]">프로필 사진 보유</span>
      </div>
      <div>
        <FieldLabel>봉직의 정보</FieldLabel>
        <p className="text-xs text-[#6B7280] mb-3">봉직의가 있는 경우 입력해주세요</p>
        {data.additionalDoctors.map((doc, idx) => (
          <div key={idx} className="bg-[#F8FAFC] rounded-lg p-3 space-y-2 mb-2">
            <div className="flex gap-2">
              <input
                placeholder="이름"
                value={doc.name}
                onChange={(e) => {
                  const updated = [...data.additionalDoctors];
                  updated[idx] = { ...updated[idx], name: e.target.value };
                  onChange({ additionalDoctors: updated });
                }}
                className="flex-1 h-10 px-3 rounded-lg border border-[#D1D5DB] text-sm focus:outline-none focus:border-[#2563EB]"
              />
              <select
                value={doc.title}
                onChange={(e) => {
                  const updated = [...data.additionalDoctors];
                  updated[idx] = { ...updated[idx], title: e.target.value };
                  onChange({ additionalDoctors: updated });
                }}
                className="w-28 h-10 px-2 rounded-lg border border-[#D1D5DB] text-sm focus:outline-none focus:border-[#2563EB]"
              >
                <option>봉직의</option>
                <option>부원장</option>
                <option>원장</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  const updated = data.additionalDoctors.filter((_, i) => i !== idx);
                  onChange({ additionalDoctors: updated });
                }}
                className="w-10 h-10 text-[#9CA3AF] hover:text-[#DC2626] text-lg flex items-center justify-center"
              >
                ×
              </button>
            </div>
            <input
              placeholder="전문의 분야 (예: 소아치과 전문의)"
              value={doc.specialty}
              onChange={(e) => {
                const updated = [...data.additionalDoctors];
                updated[idx] = { ...updated[idx], specialty: e.target.value };
                onChange({ additionalDoctors: updated });
              }}
              className="w-full h-10 px-3 rounded-lg border border-[#D1D5DB] text-sm focus:outline-none focus:border-[#2563EB]"
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange({ additionalDoctors: [...data.additionalDoctors, { name: '', title: '봉직의', specialty: '' }] })}
          className="w-full h-10 border border-dashed border-[#D1D5DB] rounded-lg text-sm text-[#6B7280] hover:border-[#2563EB] hover:text-[#2563EB] transition-colors"
        >
          + 봉직의 추가
        </button>
      </div>
    </div>
  );
}

// Step 5: 마케팅 방향
function Step5({
  data, onChange,
}: {
  data: FormData['step5'];
  onChange: (u: Partial<FormData['step5']>) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <FieldLabel>우리를 어떻게 알게 되셨나요?</FieldLabel>
        <ChipSelector
          options={REFERRAL_SOURCES}
          selected={data.referralSource}
          onChange={(v) => onChange({ referralSource: v })}
        />
      </div>
      <div>
        <FieldLabel>이전 마케팅 경험</FieldLabel>
        <TextArea
          value={data.previousMarketing}
          onChange={(v) => onChange({ previousMarketing: v })}
          placeholder="예: 네이버 블로그 대행 6개월, 인스타 광고 진행 경험 있음"
        />
      </div>
      <div>
        <FieldLabel>예산 범위</FieldLabel>
        <ChipSelector
          options={BUDGET_RANGES}
          selected={data.budgetRange ? [data.budgetRange] : []}
          onChange={(v) => onChange({ budgetRange: v[0] || '' })}
          multiple={false}
        />
      </div>
      <div>
        <FieldLabel>마케팅 목표 (최대 3개)</FieldLabel>
        <ChipSelector
          options={[
            '신규 환자 유입', '브랜드 인지도', '지역 1등', '온라인 리뷰 관리',
            '특정 진료 홍보', '개원 초기 안착', '재방문율 향상', '젊은 환자층 확보',
          ]}
          selected={data.marketingGoals}
          onChange={(v) => onChange({ marketingGoals: v })}
          max={3}
        />
      </div>
      <div>
        <FieldLabel>원하는 마케팅 채널</FieldLabel>
        <ChipSelector
          options={MARKETING_CHANNELS}
          selected={data.desiredChannels}
          onChange={(v) => onChange({ desiredChannels: v })}
        />
      </div>
      <div>
        <FieldLabel>벤치마킹 병원</FieldLabel>
        <TextArea
          value={data.benchmarkClinics}
          onChange={(v) => onChange({ benchmarkClinics: v })}
          placeholder="예: 트리움치과, 연세행복한치과 - 홈페이지 디자인 및 진료 콘텐츠 참고"
        />
      </div>
      <div>
        <FieldLabel>개원 이벤트 계획</FieldLabel>
        <TextArea
          value={data.openingEvent}
          onChange={(v) => onChange({ openingEvent: v })}
          placeholder="예: 불소도포 무료, 교정 정밀진단비 할인, 첫 방문 기념 선물"
        />
      </div>
      <div>
        <FieldLabel>추가 요청사항</FieldLabel>
        <TextArea
          value={data.additionalRequest}
          onChange={(v) => onChange({ additionalRequest: v })}
          placeholder="기타 요청사항이 있으시면 자유롭게 작성해주세요"
        />
      </div>
    </div>
  );
}

// Step 6: 계약 상품
function Step6({
  data, onChange,
}: {
  data: FormData['step6'];
  onChange: (u: Partial<FormData['step6']>) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <svg className="w-5 h-5 text-[#2563EB] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm text-[#2563EB]">
          여기부터는 <strong>담당자</strong>가 입력합니다
        </p>
      </div>

      <div>
        <FieldLabel>계약 서비스 선택</FieldLabel>
        <ContractProducts
          selected={data.services}
          onChange={(v) => onChange({ services: v })}
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange({ isStarterPackage: !data.isStarterPackage })}
          className={`w-12 h-7 rounded-full transition-all flex-shrink-0 ${
            data.isStarterPackage ? 'bg-[#2563EB]' : 'bg-[#D1D5DB]'
          }`}
        >
          <div
            className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform mx-1 ${
              data.isStarterPackage ? 'translate-x-5' : ''
            }`}
          />
        </button>
        <span className="text-sm text-[#374151]">초기개원 패키지 적용</span>
      </div>
      <div>
        <FieldLabel>계약 시작일</FieldLabel>
        <TextInput type="date" value={data.contractStartDate} onChange={(v) => onChange({ contractStartDate: v })} />
      </div>
      <div>
        <FieldLabel>월 계약금</FieldLabel>
        <TextInput value={data.monthlyFee} onChange={(v) => onChange({ monthlyFee: v })} placeholder="예: 150만원" />
      </div>
      <div>
        <FieldLabel>DID 설치 대수</FieldLabel>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => onChange({ didCount: Math.max(0, data.didCount - 1) })}
            className="w-10 h-10 rounded-lg border border-[#D1D5DB] text-[#374151] text-xl font-semibold flex items-center justify-center hover:bg-[#F3F4F6] transition-colors"
          >
            -
          </button>
          <span className="text-lg font-semibold text-[#374151] w-10 text-center">{data.didCount}</span>
          <button
            type="button"
            onClick={() => onChange({ didCount: Math.min(10, data.didCount + 1) })}
            className="w-10 h-10 rounded-lg border border-[#D1D5DB] text-[#374151] text-xl font-semibold flex items-center justify-center hover:bg-[#F3F4F6] transition-colors"
          >
            +
          </button>
        </div>
      </div>
      {data.didCount > 0 && (
        <div>
          <FieldLabel>DID 위치/방향 상세</FieldLabel>
          <TextArea
            value={data.didInfo}
            onChange={(v) => onChange({ didInfo: v })}
            placeholder="예: 데스크 왼쪽 1 가로(교정 영상), 진료실 입구 오른쪽 1 세로"
          />
        </div>
      )}
      <div>
        <FieldLabel>특이사항</FieldLabel>
        <TextArea
          value={data.specialNotes}
          onChange={(v) => onChange({ specialNotes: v })}
          placeholder="계약 관련 특이사항"
        />
      </div>
    </div>
  );
}

// Step 7: 최종 확인
function Step7({
  data, onGoToStep,
}: {
  data: FormData;
  onGoToStep: (step: number) => void;
}) {
  const SummarySection = ({
    title, stepIndex, children,
  }: {
    title: string; stepIndex: number; children: React.ReactNode;
  }) => (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#374151]">{title}</h3>
        <button
          onClick={() => onGoToStep(stepIndex)}
          className="text-xs text-[#2563EB] font-medium hover:underline"
        >
          수정
        </button>
      </div>
      <div className="text-sm text-[#6B7280] space-y-1">{children}</div>
    </div>
  );

  const SummaryItem = ({ label, value }: { label: string; value: string | undefined }) => {
    if (!value || !value.trim()) return null;
    return (
      <div className="flex">
        <span className="w-24 flex-shrink-0 text-[#9CA3AF]">{label}</span>
        <span className="text-[#374151]">{value}</span>
      </div>
    );
  };

  const { step1, step2, step3, step4, step5, step6 } = data;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-[#374151] mb-2">최종 확인</h2>
      <p className="text-sm text-[#6B7280] mb-4">
        입력하신 내용을 확인 후 제출해주세요. 각 섹션의 [수정] 버튼으로 수정할 수 있습니다.
      </p>

      <SummarySection title="기본 정보" stepIndex={0}>
        <SummaryItem label="치과명" value={step1.clinicName} />
        <SummaryItem label="원장명" value={step1.doctorName} />
        <SummaryItem label="개원예정일" value={step1.openDate} />
        <SummaryItem label="지역" value={[step1.region.city, step1.region.district, step1.region.dong].filter(Boolean).join(' ')} />
        <SummaryItem label="주소" value={step1.address} />
        <SummaryItem label="대표전화" value={step1.phone} />
        <SummaryItem label="팩스번호" value={step1.fax} />
        <SummaryItem label="가오픈예정일" value={step1.softOpenDate} />
        <SummaryItem label="인테리어완료일" value={step1.interiorCompleteDate} />
        <SummaryItem label="촬영가능일" value={step1.photoDate} />
        <SummaryItem label="총 의료진" value={step1.doctorCount ? `${step1.doctorCount}명` : undefined} />
      </SummarySection>

      <SummarySection title="진료 정보" stepIndex={1}>
        <SummaryItem label="진료과목" value={step2.dentalSubjects.join(', ')} />
        <SummaryItem label="주력진료" value={step2.topSubjects.join(', ')} />
        <SummaryItem label="공휴일" value={step2.holidayClose ? '휴진' : '진료'} />
        <SummaryItem label="점심시간" value={`${step2.lunchTime.start} ~ ${step2.lunchTime.end}`} />
      </SummarySection>

      <SummarySection title="시설/장비" stepIndex={2}>
        <SummaryItem label="체어 수" value={`${step3.chairs}대`} />
        <SummaryItem label="장비" value={step3.equipment.join(', ')} />
        <SummaryItem label="시설" value={step3.facilities.join(', ')} />
        <SummaryItem label="주차" value={step3.parking.detail ? `${step3.parking.available} (${step3.parking.detail})` : step3.parking.available} />
        <SummaryItem label="인테리어" value={step3.interiorStyle} />
        <SummaryItem label="임플란트" value={step3.implantBrands.join(', ')} />
        <SummaryItem label="기공소" value={step3.hasLabRoom ? `보유${step3.labEquipment.length > 0 ? ` (${step3.labEquipment.join(', ')})` : ''}` : '미보유'} />
      </SummarySection>

      <SummarySection title="브랜딩 & 철학" stepIndex={3}>
        <SummaryItem label="한줄소개" value={step4.oneLiner} />
        <SummaryItem label="타겟환자" value={step4.targetPatients} />
        <SummaryItem label="차별점" value={step4.differentiator} />
        {step4.additionalDoctors.length > 0 && (
          <SummaryItem label="봉직의" value={step4.additionalDoctors.map((d) => `${d.name} ${d.title}${d.specialty ? ` (${d.specialty})` : ''}`).join(', ')} />
        )}
      </SummarySection>

      <SummarySection title="마케팅 방향" stepIndex={4}>
        <SummaryItem label="유입경로" value={step5.referralSource.join(', ')} />
        <SummaryItem label="예산" value={step5.budgetRange} />
        <SummaryItem label="목표" value={step5.marketingGoals.join(', ')} />
        <SummaryItem label="채널" value={step5.desiredChannels.join(', ')} />
        <SummaryItem label="벤치마킹" value={step5.benchmarkClinics} />
        <SummaryItem label="개원이벤트" value={step5.openingEvent} />
      </SummarySection>

      <SummarySection title="계약 상품" stepIndex={5}>
        <SummaryItem
          label="서비스"
          value={step6.services.map((s) => {
            const svc = SERVICES_LIST.find((sv) => sv.id === s.serviceId);
            return svc ? `${svc.name}${s.quantity ? ` ${s.quantity}${svc.unit}` : ''}` : s.serviceId;
          }).join(', ')}
        />
        <SummaryItem label="패키지" value={step6.isStarterPackage ? '초기개원 패키지' : '일반'} />
        <SummaryItem label="계약시작" value={step6.contractStartDate} />
        <SummaryItem label="월계약금" value={step6.monthlyFee} />
        {step6.didCount > 0 && (
          <SummaryItem label="DID 대수" value={`${step6.didCount}대${step6.didInfo ? ` - ${step6.didInfo}` : ''}`} />
        )}
      </SummarySection>
    </div>
  );
}
