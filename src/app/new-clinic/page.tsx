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
import FileUpload, { type UploadedFile } from '@/components/FileUpload';
import { SERVICES as SERVICES_LIST } from '@/data/services';
import {
  DENTAL_CATEGORIES,
  EQUIPMENT_LIST,
  FACILITY_LIST,
  MARKETING_CHANNELS,
  REFERRAL_SOURCES,
  REFERRAL_NEEDS_NAME,
  BUDGET_RANGES,
  WEEKDAYS,
  IMPLANT_MATERIALS,
  ALIGNER_OPTIONS,
  PEDIATRIC_ORTHO_OPTIONS,
  HOMEPAGE_FEATURES,
  SSL_OPTIONS,
  CMS_OPTIONS,
  RENEWAL_OPTIONS,
  MAINTENANCE_OPTIONS,
} from '@/data/dental';

const STEP_LABELS = [
  '기본 정보',
  '진료 정보',
  '시설/장비',
  '브랜딩 & 철학',
  '마케팅 방향',
  '홈페이지/웹',
  '계약 상품',
  '최종 확인',
];
const TOTAL_STEPS = 8;

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
    /**
     * 의료진 명단. 첫 번째 항목은 메인 원장(doctorName 자동 반영).
     * doctorCount 변경 시 길이가 자동 동기화됨.
     */
    doctors: { name: string; title: string; specialty: string }[];
    careerImages: UploadedFile[];
  };
  step2: {
    dentalSubjects: string[];
    topSubjects: string[];
    /** 임플란트 재료: 제조사 → 선택된 제품군 */
    implantMaterials: Record<string, string[]>;
    /** 투명교정 세부 옵션 (교정→투명교정 선택 시) */
    alignerOptions: string[];
    /** 소아교정 세부 옵션 (교정→소아교정 선택 시) */
    pediatricOrthoOptions: string[];
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
    hasLabRoom: boolean;
    labEquipment: string[];
    blueprintFiles: UploadedFile[];
  };
  step4: {
    oneLiner: string;
    /** 슬로건 / 태그라인 (브랜딩 인터뷰 도출) */
    slogan: string;
    /** 브랜드 비전 / 목표 (브랜딩 인터뷰 도출) */
    brandVision: string;
    /** 브랜드 톤앤매너 — 성격·말투 (브랜딩 인터뷰 도출) */
    brandTone: string;
    /** 진료 철학 포인트 (옛 philosophy 대체) */
    philosophy: string;
    /** 의료진 홍보 포인트 */
    doctorPromo: string;
    /** 병원 홍보 포인트 */
    clinicPromo: string;
    /** 주요 진료 홍보 포인트 */
    treatmentPromo: string;
    /** 병원 입지 및 타겟 (옛 targetPatients 대체) */
    locationTarget: string;
    /** 인테리어 컨셉 (Step 3에서 이동) */
    interiorStyle: string;
    /** 브랜드 컬러 */
    brandColor: string;
    hasProfilePhoto: boolean;
    hasLogo: boolean;
    logoFiles: UploadedFile[];
    licenseFiles: UploadedFile[];
    certificateFiles: UploadedFile[];
    businessFiles: UploadedFile[];
    permitFiles: UploadedFile[];
    signageFiles: UploadedFile[];
    bannerFiles: UploadedFile[];
    constructionFiles: UploadedFile[];
  };
  step5: {
    referralSource: string[];
    /** 소개해 준 사람 이름 (referralSource에 '컨설팅 소개' 또는 '지인 소개' 포함 시) */
    referralName: string;
    previousMarketing: string;
    budgetRange: string;
    marketingGoals: string[];
    desiredChannels: string[];
    additionalRequest: string;
    benchmarkClinics: string;
    openingEvent: string;
    /** DID 정보 (Step 6에서 이동) */
    didInfo: string;
    /** 네이버 리뷰 증정선물 */
    reviewGift: string;
    /** 카톡 채널 증정선물 */
    channelGift: string;
  };
  /** 홈페이지/웹 제작 정보 (계약 서비스에 홈페이지 포함 시 작성) */
  stepWeb: {
    // 오시는 길
    subway: string;
    bus: string;
    locationNote: string;
    // 원장 약력 (홈페이지용 상세)
    education: string;
    career: string;
    associations: string;
    awards: string;
    // 디자인 방향
    mainKeywords: string;
    referenceSites: string;
    designFocus: string;
    mainEmphasis: string;
    photoDirection: string;
    // 온라인 채널 & 도메인
    instagramUrl: string;
    blogUrl: string;
    youtubeUrl: string;
    kakaoChannel: string;
    naverBooking: string;
    desiredDomain: string;
    ssl: string;
    // 기능 요구사항
    features: string[];
    cmsNeed: string;
    renewalType: string;
    oldSiteUrl: string;
    // 일정/유지보수
    homepageDeadline: string;
    maintenance: string;
  };
  step6: {
    services: { serviceId: string; quantity?: number }[];
    isStarterPackage: boolean;
    contractStartDate: string;
    monthlyFee: string;
    specialNotes: string;
  };
}

const INITIAL_DATA: FormData = {
  step1: {
    clinicName: '', doctorName: '', openDate: '',
    region: { city: '', district: '' }, address: '', phone: '', fax: '',
    softOpenDate: '', interiorCompleteDate: '', photoDate: '',
    doctorCount: 1,
    doctors: [{ name: '', title: '원장', specialty: '' }],
    careerImages: [],
  },
  step2: {
    dentalSubjects: [], topSubjects: [],
    implantMaterials: {},
    alignerOptions: [],
    pediatricOrthoOptions: [],
    schedule: DEFAULT_SCHEDULE,
    holidays: [], holidayClose: true,
    lunchTime: { start: '12:30', end: '13:30' }, nightWeekend: '',
  },
  step3: {
    chairs: 5, equipment: [], facilities: [],
    parking: { available: '가능', detail: '' },
    hasLabRoom: false, labEquipment: [], blueprintFiles: [],
  },
  step4: {
    oneLiner: '', slogan: '', brandVision: '', brandTone: '',
    philosophy: '',
    doctorPromo: '', clinicPromo: '', treatmentPromo: '',
    locationTarget: '', interiorStyle: '', brandColor: '',
    hasProfilePhoto: false, hasLogo: false,
    logoFiles: [], licenseFiles: [], certificateFiles: [], businessFiles: [],
    permitFiles: [], signageFiles: [], bannerFiles: [], constructionFiles: [],
  },
  step5: {
    referralSource: [], referralName: '',
    previousMarketing: '', budgetRange: '',
    marketingGoals: [], desiredChannels: [],
    additionalRequest: '', benchmarkClinics: '', openingEvent: '',
    didInfo: '', reviewGift: '', channelGift: '',
  },
  stepWeb: {
    subway: '', bus: '', locationNote: '',
    education: '', career: '', associations: '', awards: '',
    mainKeywords: '', referenceSites: '', designFocus: '', mainEmphasis: '', photoDirection: '',
    instagramUrl: '', blogUrl: '', youtubeUrl: '', kakaoChannel: '', naverBooking: '',
    desiredDomain: '', ssl: '',
    features: [], cmsNeed: '', renewalType: '', oldSiteUrl: '',
    homepageDeadline: '', maintenance: '',
  },
  step6: {
    services: [], isStarterPackage: false,
    contractStartDate: '', monthlyFee: '', specialNotes: '',
  },
};

export default function NewClinicPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
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
    setConfirmed(false);
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
        error instanceof Error ? error.message : '저장에 실패했습니다. 입력 내용은 기기에 보관 중이오니 다시 시도해 주세요'
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
        steps={['치과 정보를 저장하고 있습니다...', '팀별 업무를 생성하고 있습니다...', '완료!']}
        currentStepIndex={submitStep}
      />

      {/* 상단 헤더 */}
      <header className="bg-white border-b border-[#E5E7EB] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto">
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
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-6 pb-28">
        <div key={step} className="animate-fade-slide-in">
          {step === 0 && <Step1 data={data.step1} onChange={(u) => updateStep('step1', u)} />}
          {step === 1 && <Step2 data={data.step2} onChange={(u) => updateStep('step2', u)} />}
          {step === 2 && <Step3 data={data.step3} onChange={(u) => updateStep('step3', u)} />}
          {step === 3 && <Step4 data={data.step4} onChange={(u) => updateStep('step4', u)} />}
          {step === 4 && <Step5 data={data.step5} onChange={(u) => updateStep('step5', u)} />}
          {step === 5 && <StepWeb data={data.stepWeb} onChange={(u) => updateStep('stepWeb', u)} />}
          {step === 6 && <Step6 data={data.step6} onChange={(u) => updateStep('step6', u)} />}
          {step === 7 && <Step7 data={data} onGoToStep={goToStep} confirmed={confirmed} setConfirmed={setConfirmed} />}
        </div>
      </main>

      {/* 하단 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
        <div className="max-w-4xl mx-auto px-6 py-4 flex gap-3">
          {step > 0 && step < 7 && (
            <button
              onClick={prevStep}
              className="h-12 px-6 bg-white border border-[#D1D5DB] text-[#374151] rounded-lg font-medium"
            >
              이전
            </button>
          )}
          {step < 7 ? (
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
              disabled={submitting || !confirmed}
              title={!confirmed ? '먼저 "위 내용을 모두 확인했습니다" 체크박스를 선택해주세요' : undefined}
              className="flex-1 h-12 bg-[#2563EB] text-white rounded-lg font-semibold
                         hover:bg-[#1d4ed8] active:scale-[0.98] transition-all
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {confirmed ? '제출하기' : '확인 후 제출 가능'}
            </button>
          )}
        </div>
        {submitError && (
          <div className="max-w-4xl mx-auto px-6 pb-4">
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
        <FieldLabel required>총 의료진 수</FieldLabel>
        <p className="text-xs text-[#6B7280] mb-3">원장 포함 전체 의료진 인원. 인원에 맞춰 아래 입력 칸이 자동으로 생성됩니다.</p>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => {
              const cur = data.doctorCount || 1;
              const next = Math.max(1, cur - 1);
              const doctors = (data.doctors || []).slice(0, next);
              onChange({ doctorCount: next, doctors });
            }}
            aria-label="의료진 수 감소"
            className="w-10 h-10 rounded-full border border-[#D1D5DB] text-[#374151] text-xl font-light flex items-center justify-center hover:border-[#2563EB] hover:text-[#2563EB] transition-colors"
          >−</button>
          <span className="text-2xl font-bold text-[#2563EB] w-16 text-center">
            {data.doctorCount || 1}명
          </span>
          <button
            type="button"
            onClick={() => {
              const cur = data.doctorCount || 1;
              const next = Math.min(20, cur + 1);
              const doctors = [...(data.doctors || [])];
              while (doctors.length < next) {
                doctors.push({
                  name: '',
                  title: doctors.length === 0 ? '원장' : '봉직의',
                  specialty: '',
                });
              }
              onChange({ doctorCount: next, doctors });
            }}
            aria-label="의료진 수 증가"
            className="w-10 h-10 rounded-full border border-[#D1D5DB] text-[#374151] text-xl font-light flex items-center justify-center hover:border-[#2563EB] hover:text-[#2563EB] transition-colors"
          >+</button>
        </div>
      </div>

      <div>
        <FieldLabel>의료진 명단</FieldLabel>
        <p className="text-xs text-[#6B7280] mb-3">{data.doctorCount || 1}명의 의료진 정보를 입력해 주세요. 첫 번째는 대표 원장입니다.</p>
        <div className="space-y-3">
          {Array.from({ length: data.doctorCount || 1 }).map((_, idx) => {
            const doc = (data.doctors && data.doctors[idx]) || {
              name: idx === 0 ? data.doctorName : '',
              title: idx === 0 ? '원장' : '봉직의',
              specialty: '',
            };
            const isMain = idx === 0;
            const updateDoctor = (patch: Partial<typeof doc>) => {
              const doctors = [...(data.doctors || [])];
              while (doctors.length <= idx) {
                doctors.push({ name: '', title: '봉직의', specialty: '' });
              }
              doctors[idx] = { ...doctors[idx], ...patch };
              // 첫 번째 의료진의 이름은 doctorName과 동기
              const updates: Partial<FormData['step1']> = { doctors };
              if (isMain && 'name' in patch) {
                updates.doctorName = patch.name || '';
              }
              onChange(updates);
            };
            return (
              <div
                key={idx}
                className={`rounded-xl p-4 space-y-2 border ${
                  isMain
                    ? 'bg-[#EFF6FF] border-[#2563EB]'
                    : 'bg-[#F8FAFC] border-[#E5E7EB]'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-bold ${isMain ? 'text-[#2563EB]' : 'text-[#6B7280]'}`}>
                    {isMain ? '👑 대표 원장' : `의료진 ${idx + 1}`}
                  </span>
                </div>
                <div className="flex gap-2">
                  <input
                    placeholder="성함"
                    value={doc.name || (isMain ? data.doctorName : '')}
                    onChange={(e) => updateDoctor({ name: e.target.value })}
                    className="flex-1 h-10 px-3 rounded-lg border border-[#D1D5DB] bg-white text-sm focus:outline-none focus:border-[#2563EB]"
                  />
                  <select
                    value={doc.title}
                    onChange={(e) => updateDoctor({ title: e.target.value })}
                    className="w-28 h-10 px-2 rounded-lg border border-[#D1D5DB] bg-white text-sm focus:outline-none focus:border-[#2563EB]"
                  >
                    <option>원장</option>
                    <option>공동원장</option>
                    <option>부원장</option>
                    <option>봉직의</option>
                    <option>페이닥터</option>
                  </select>
                </div>
                <input
                  placeholder="전문의 분야 (예: 보철과 전문의, 또는 비워두기)"
                  value={doc.specialty}
                  onChange={(e) => updateDoctor({ specialty: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-[#D1D5DB] bg-white text-sm focus:outline-none focus:border-[#2563EB]"
                />
              </div>
            );
          })}
        </div>
      </div>

      <FileUpload
        label="의료진 약력 이미지"
        category="career"
        clinicName={data.clinicName}
        accept="image/jpeg,image/png"
        multiple
        maxFiles={10}
        files={data.careerImages}
        onChange={(files) => onChange({ careerImages: files })}
        hint="이력서/약력서 사진을 업로드하실 수 있습니다 (선택, jpg/png)"
      />
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
        <p className="text-xs text-[#6B7280] mb-3">해당하는 진료과목을 모두 선택해 주세요</p>
        <CategoryChipSelector
          categories={DENTAL_CATEGORIES}
          selected={data.dentalSubjects}
          onChange={(v) => onChange({ dentalSubjects: v })}
        />
      </div>
      {data.dentalSubjects.length > 0 && (
        <div>
          <FieldLabel>주력진료 TOP 3</FieldLabel>
          <p className="text-xs text-[#6B7280] mb-3">주력으로 마케팅하실 과목을 최대 3개까지 선택해 주세요</p>
          <ChipSelector
            options={data.dentalSubjects}
            selected={data.topSubjects}
            onChange={(v) => onChange({ topSubjects: v })}
            max={3}
          />
        </div>
      )}
      {/* 투명교정 선택 시 서브옵션 노출 */}
      {data.dentalSubjects.includes('투명교정') && (
        <div>
          <FieldLabel>투명교정 — 사용 브랜드</FieldLabel>
          <p className="text-xs text-[#6B7280] mb-3">사용하시는 브랜드를 모두 선택해 주세요</p>
          <ChipSelector
            options={ALIGNER_OPTIONS}
            selected={data.alignerOptions || []}
            onChange={(v) => onChange({ alignerOptions: v })}
          />
        </div>
      )}
      {/* 소아교정 선택 시 서브옵션 노출 */}
      {data.dentalSubjects.includes('소아교정') && (
        <div>
          <FieldLabel>소아교정 — 사용 장치</FieldLabel>
          <p className="text-xs text-[#6B7280] mb-3">사용하시는 장치를 모두 선택해 주세요</p>
          <ChipSelector
            options={PEDIATRIC_ORTHO_OPTIONS}
            selected={data.pediatricOrthoOptions || []}
            onChange={(v) => onChange({ pediatricOrthoOptions: v })}
          />
        </div>
      )}
      {/* 임플란트 진료과목 선택 시 재료 UI 노출 */}
      {DENTAL_CATEGORIES['임플란트'].some((s) => data.dentalSubjects.includes(s)) && (
        <div>
          <FieldLabel>임플란트 재료 (사용 제조사·제품군)</FieldLabel>
          <p className="text-xs text-[#6B7280] mb-3">사용하시는 제조사를 선택하면 하위 제품군이 나타납니다. 여러 개 선택 가능.</p>
          <div className="space-y-2">
            {Object.entries(IMPLANT_MATERIALS).map(([brand, products]) => {
              const isSelected = brand in (data.implantMaterials || {});
              const selectedProducts = (data.implantMaterials || {})[brand] || [];
              return (
                <div
                  key={brand}
                  className={`rounded-xl border ${
                    isSelected ? 'border-[#2563EB] bg-[#EFF6FF]' : 'border-[#E5E7EB] bg-white'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      const next = { ...(data.implantMaterials || {}) };
                      if (isSelected) {
                        delete next[brand];
                      } else {
                        next[brand] = [];
                      }
                      onChange({ implantMaterials: next });
                    }}
                    className="w-full px-4 py-3 flex items-center gap-2 text-left"
                  >
                    <span
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'bg-[#2563EB] border-[#2563EB]' : 'border-[#D1D5DB]'
                      }`}
                    >
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    <span className={`text-sm font-medium ${isSelected ? 'text-[#2563EB]' : 'text-[#374151]'}`}>
                      {brand}
                    </span>
                  </button>
                  {isSelected && products.length > 0 && (
                    <div className="px-4 pb-3 pt-1 pl-11 flex flex-wrap gap-2">
                      {products.map((p) => {
                        const pSelected = selectedProducts.includes(p);
                        return (
                          <button
                            key={p}
                            type="button"
                            onClick={() => {
                              const next = { ...(data.implantMaterials || {}) };
                              const cur = next[brand] || [];
                              next[brand] = pSelected
                                ? cur.filter((x) => x !== p)
                                : [...cur, p];
                              onChange({ implantMaterials: next });
                            }}
                            className={`h-8 px-3 rounded-full text-xs font-medium transition-all ${
                              pSelected
                                ? 'bg-[#2563EB] text-white'
                                : 'bg-white border border-[#D1D5DB] text-[#374151] hover:border-[#2563EB] hover:text-[#2563EB]'
                            }`}
                          >
                            {p}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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
      <FileUpload
        label="인테리어 3D 도면"
        category="blueprint"
        accept="application/pdf,image/jpeg,image/png"
        multiple
        maxFiles={5}
        files={data.blueprintFiles}
        onChange={(files) => onChange({ blueprintFiles: files })}
        hint="3D 도면 또는 평면도를 업로드해 주세요 (선택, PDF/jpg/png, 최대 50MB)"
      />
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
        <FieldLabel>슬로건 / 태그라인</FieldLabel>
        <TextInput
          value={data.slogan}
          onChange={(v) => onChange({ slogan: v })}
          placeholder="예: 평생 가는 치아, 평생 가는 치과 (브랜딩 인터뷰에서 도출)"
        />
      </div>

      {/* 6가지 브랜딩 포인트 */}
      <div>
        <FieldLabel>의료진 홍보 포인트</FieldLabel>
        <TextArea
          value={data.doctorPromo}
          onChange={(v) => onChange({ doctorPromo: v })}
          placeholder="예: 연세대 출신 보철 전문의, 임상 10년+, OO학회 정회원"
          rows={3}
        />
      </div>
      <div>
        <FieldLabel>병원 홍보 포인트</FieldLabel>
        <TextArea
          value={data.clinicPromo}
          onChange={(v) => onChange({ clinicPromo: v })}
          placeholder="예: 디지털 장비 풀세트, 24시간 응급대응, 키즈룸 보유"
          rows={3}
        />
      </div>
      <div>
        <FieldLabel>주요 진료 홍보 포인트</FieldLabel>
        <TextArea
          value={data.treatmentPromo}
          onChange={(v) => onChange({ treatmentPromo: v })}
          placeholder="예: 디지털 임플란트(가이드 수술), 투명교정(인비절라인 다이아몬드)"
          rows={3}
        />
      </div>
      <div>
        <FieldLabel>진료 철학 포인트</FieldLabel>
        <TextArea
          value={data.philosophy}
          onChange={(v) => onChange({ philosophy: v })}
          placeholder="예: 과잉진료 없이 꼭 필요한 치료만, 투명한 설명과 합리적 비용"
          rows={3}
        />
      </div>
      <div>
        <FieldLabel>브랜드 비전 / 목표</FieldLabel>
        <TextArea
          value={data.brandVision}
          onChange={(v) => onChange({ brandVision: v })}
          placeholder="예: 3~5년 내 지역에서 가장 신뢰받는 임플란트 치과로 자리매김 (브랜딩 인터뷰에서 도출)"
          rows={2}
        />
      </div>
      <div>
        <FieldLabel>브랜드 톤앤매너 (성격·말투)</FieldLabel>
        <TextInput
          value={data.brandTone}
          onChange={(v) => onChange({ brandTone: v })}
          placeholder="예: 따뜻하고 친근한 / 믿음직한 전문가 톤 (브랜딩 인터뷰에서 도출)"
        />
      </div>
      <div>
        <FieldLabel>병원 입지 및 타겟</FieldLabel>
        <TextArea
          value={data.locationTarget}
          onChange={(v) => onChange({ locationTarget: v })}
          placeholder="예: 1번 출구 도보 3분, 직장가 + 아파트단지 인접, 30~50대 직장인 + 가족 환자"
          rows={3}
        />
      </div>
      <div>
        <FieldLabel>인테리어 컨셉</FieldLabel>
        <TextInput
          value={data.interiorStyle}
          onChange={(v) => onChange({ interiorStyle: v })}
          placeholder="예: 모던, 따뜻한 우드톤, 아이 친화적"
        />
      </div>
      <div>
        <FieldLabel>브랜드 컬러</FieldLabel>
        <TextInput
          value={data.brandColor}
          onChange={(v) => onChange({ brandColor: v })}
          placeholder="있으시면 작성 (예: 메인 네이비 #1E3A5F, 포인트 골드)"
        />
      </div>

      {/* 보유 여부 토글 */}
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
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange({ hasLogo: !data.hasLogo })}
          className={`w-12 h-7 rounded-full transition-all flex-shrink-0 ${
            data.hasLogo ? 'bg-[#2563EB]' : 'bg-[#D1D5DB]'
          }`}
        >
          <div
            className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform mx-1 ${
              data.hasLogo ? 'translate-x-5' : ''
            }`}
          />
        </button>
        <span className="text-sm text-[#374151]">로고 파일 보유</span>
      </div>

      {/* 첨부 자료 섹션 */}
      <div className="bg-[#F8FAFC] rounded-xl p-5 space-y-5 border border-[#E5E7EB]">
        <div>
          <h3 className="text-base font-bold text-[#374151]">📎 첨부 자료</h3>
          <p className="text-xs text-[#6B7280] mt-1">보유하신 자료를 업로드해 주세요. 모두 선택 사항입니다.</p>
        </div>

        <FileUpload
          label="로고 파일"
          category="logo"
          accept=".png,.jpg,.jpeg,.svg,.ai,.pdf"
          multiple
          maxFiles={5}
          files={data.logoFiles}
          onChange={(files) => onChange({ logoFiles: files })}
          hint="치과 로고 파일 (png/jpg/svg/ai/pdf) — 원본 파일 권장"
        />

        <FileUpload
          label="치과의사 면허증"
          category="license"
          accept=".pdf,.jpg,.jpeg,.png"
          files={data.licenseFiles}
          onChange={(files) => onChange({ licenseFiles: files })}
          hint="원장님 면허증 사본 (PDF/jpg/png)"
        />

        <FileUpload
          label="전문의 자격증"
          category="certificate"
          accept=".pdf,.jpg,.jpeg,.png"
          multiple
          maxFiles={5}
          files={data.certificateFiles}
          onChange={(files) => onChange({ certificateFiles: files })}
          hint="전문의 자격증이 있으시면 업로드해 주세요 (여러 장 가능)"
        />

        <FileUpload
          label="사업자등록증"
          category="business"
          accept=".pdf,.jpg,.jpeg,.png"
          files={data.businessFiles}
          onChange={(files) => onChange({ businessFiles: files })}
          hint="PDF 또는 이미지"
        />

        <FileUpload
          label="개설필증"
          category="permit"
          accept=".pdf,.jpg,.jpeg,.png"
          files={data.permitFiles}
          onChange={(files) => onChange({ permitFiles: files })}
          hint="의료기관 개설 신고증"
        />

        <FileUpload
          label="간판 사진"
          category="signage"
          accept=".jpg,.jpeg,.png"
          multiple
          maxFiles={5}
          files={data.signageFiles}
          onChange={(files) => onChange({ signageFiles: files })}
          hint="간판이 설치되어 있으면 사진을 올려 주세요"
        />

        <FileUpload
          label="현수막 사진"
          category="banner"
          accept=".jpg,.jpeg,.png"
          multiple
          maxFiles={5}
          files={data.bannerFiles}
          onChange={(files) => onChange({ bannerFiles: files })}
          hint="개원 안내 현수막 사진"
        />

        <FileUpload
          label="공사 현장 사진"
          category="construction"
          accept=".jpg,.jpeg,.png"
          multiple
          maxFiles={10}
          files={data.constructionFiles}
          onChange={(files) => onChange({ constructionFiles: files })}
          hint="인테리어 진행 상황 사진 (최대 10장)"
        />
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
        {data.referralSource.some((s) => REFERRAL_NEEDS_NAME.includes(s)) && (
          <div className="mt-3">
            <p className="text-xs text-[#6B7280] mb-2">소개해 주신 분의 성함을 적어 주세요</p>
            <TextInput
              value={data.referralName}
              onChange={(v) => onChange({ referralName: v })}
              placeholder="예: 김OO 컨설턴트, 옆 OO치과 원장님"
            />
          </div>
        )}
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
        <FieldLabel>DID 정보</FieldLabel>
        <p className="text-xs text-[#6B7280] mb-2">설치 위치, 가로/세로 방향, 보유 대수 등을 자유롭게 적어 주세요</p>
        <TextArea
          value={data.didInfo}
          onChange={(v) => onChange({ didInfo: v })}
          placeholder="예: 데스크 왼쪽 1대 가로(교정 영상), 진료실 입구 오른쪽 1대 세로 / 미설치"
        />
      </div>
      <div>
        <FieldLabel>네이버 리뷰 증정선물</FieldLabel>
        <p className="text-xs text-[#6B7280] mb-2">리뷰 작성 시 환자에게 드릴 선물을 정하셨다면 적어 주세요</p>
        <TextInput
          value={data.reviewGift}
          onChange={(v) => onChange({ reviewGift: v })}
          placeholder="예: 음료 1잔 쿠폰, 5,000원 상품권, 스케일링 50% 할인"
        />
      </div>
      <div>
        <FieldLabel>카톡 채널 추가 증정선물</FieldLabel>
        <p className="text-xs text-[#6B7280] mb-2">카카오톡 채널 추가 시 환자에게 드릴 선물</p>
        <TextInput
          value={data.channelGift}
          onChange={(v) => onChange({ channelGift: v })}
          placeholder="예: 칫솔 1세트, 가글 1병, 다음 방문 할인 쿠폰"
        />
      </div>
      <div>
        <FieldLabel>추가 요청사항</FieldLabel>
        <TextArea
          value={data.additionalRequest}
          onChange={(v) => onChange({ additionalRequest: v })}
          placeholder="기타 요청사항이 있으시면 자유롭게 적어 주세요"
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

// Step Web: 홈페이지/웹
function WebSubhead({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="pt-2">
      <h3 className="text-base font-bold text-[#374151]">{children}</h3>
      {hint && <p className="text-xs text-[#6B7280] mt-1">{hint}</p>}
    </div>
  );
}

function StepWeb({
  data, onChange,
}: {
  data: FormData['stepWeb'];
  onChange: (u: Partial<FormData['stepWeb']>) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <svg className="w-5 h-5 text-[#2563EB] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm text-[#2563EB]">
          홈페이지 제작을 진행하는 경우 작성해 주세요. <strong>해당 없으면 비워두셔도 됩니다.</strong>
        </p>
      </div>

      {/* 오시는 길 */}
      <WebSubhead hint="홈페이지·블로그 '오시는 길'에 그대로 노출됩니다">📍 오시는 길</WebSubhead>
      <div>
        <FieldLabel>지하철 노선</FieldLabel>
        <TextInput value={data.subway} onChange={(v) => onChange({ subway: v })} placeholder="예: 압구정로데오역 5번 출구 도보 5분" />
      </div>
      <div>
        <FieldLabel>버스 노선</FieldLabel>
        <TextInput value={data.bus} onChange={(v) => onChange({ bus: v })} placeholder="예: 강남역 정류장, 140번, 146번" />
      </div>
      <div>
        <FieldLabel>위치 특이사항 / 어필 사항</FieldLabel>
        <TextInput value={data.locationNote} onChange={(v) => onChange({ locationNote: v })} placeholder="예: 건물 내 엘리베이터 바로 앞, 랜드마크 인근" />
      </div>

      {/* 원장 약력 */}
      <WebSubhead hint="홈페이지 의료진 소개에 사용됩니다">👩‍⚕️ 원장 약력 (상세)</WebSubhead>
      <div>
        <FieldLabel>학력</FieldLabel>
        <TextArea value={data.education} onChange={(v) => onChange({ education: v })} placeholder="예: 서울대학교 치과대학 졸업" rows={2} />
      </div>
      <div>
        <FieldLabel>전직 경력 (병원명·직위 전부)</FieldLabel>
        <TextArea value={data.career} onChange={(v) => onChange({ career: v })} placeholder="예: 전) OO치과의원 원장 / 전) OO치과 총괄원장" rows={3} />
      </div>
      <div>
        <FieldLabel>학회 / 협회 활동</FieldLabel>
        <TextArea value={data.associations} onChange={(v) => onChange({ associations: v })} placeholder="예: 대한치과보철학회 정회원 / 대한구강악안면임플란트학회 회원" rows={2} />
      </div>
      <div>
        <FieldLabel>수상 / 논문 / 방송 출연 이력</FieldLabel>
        <TextArea value={data.awards} onChange={(v) => onChange({ awards: v })} placeholder="있으시면 작성해 주세요" rows={2} />
      </div>

      {/* 디자인 방향 */}
      <WebSubhead>🎨 키워드 및 디자인 방향</WebSubhead>
      <div>
        <FieldLabel>병원 상징 메인 키워드 (우선순위 순)</FieldLabel>
        <TextInput value={data.mainKeywords} onChange={(v) => onChange({ mainKeywords: v })} placeholder="예: 프리미엄, 신뢰, 자연스러움, 전문성" />
      </div>
      <div>
        <FieldLabel>참고 / 좋아하는 사이트 URL</FieldLabel>
        <TextArea value={data.referenceSites} onChange={(v) => onChange({ referenceSites: v })} placeholder="마음에 드는 홈페이지 주소를 적어 주세요 (여러 개 가능)" rows={2} />
      </div>
      <div>
        <FieldLabel>디자인 작업 시 중점 사항</FieldLabel>
        <TextInput value={data.designFocus} onChange={(v) => onChange({ designFocus: v })} placeholder="예: 인물 위주 / 사진 위주 / 깔끔한 텍스트 중심" />
      </div>
      <div>
        <FieldLabel>메인 페이지에서 가장 강조할 내용</FieldLabel>
        <TextArea value={data.mainEmphasis} onChange={(v) => onChange({ mainEmphasis: v })} placeholder="메인 화면에 가장 부각되었으면 하는 내용" rows={2} />
      </div>
      <div>
        <FieldLabel>병원 대표 사진 / 이미지 방향</FieldLabel>
        <TextArea value={data.photoDirection} onChange={(v) => onChange({ photoDirection: v })} placeholder="예: 밝고 깔끔한 원장 프로필 + 인테리어 사진 보유 (사진 파일은 별도 전달)" rows={2} />
      </div>

      {/* 온라인 채널 & 도메인 */}
      <WebSubhead>📱 온라인 채널 & 도메인</WebSubhead>
      <div>
        <FieldLabel>인스타그램 URL</FieldLabel>
        <TextInput value={data.instagramUrl} onChange={(v) => onChange({ instagramUrl: v })} placeholder="https://www.instagram.com/..." />
      </div>
      <div>
        <FieldLabel>블로그 URL</FieldLabel>
        <TextInput value={data.blogUrl} onChange={(v) => onChange({ blogUrl: v })} placeholder="https://blog.naver.com/..." />
      </div>
      <div>
        <FieldLabel>유튜브 채널 URL</FieldLabel>
        <TextInput value={data.youtubeUrl} onChange={(v) => onChange({ youtubeUrl: v })} placeholder="https://youtube.com/..." />
      </div>
      <div>
        <FieldLabel>카카오톡 채널</FieldLabel>
        <TextInput value={data.kakaoChannel} onChange={(v) => onChange({ kakaoChannel: v })} placeholder="채널명 또는 URL" />
      </div>
      <div>
        <FieldLabel>네이버 예약 URL</FieldLabel>
        <TextInput value={data.naverBooking} onChange={(v) => onChange({ naverBooking: v })} placeholder="https://booking.naver.com/..." />
      </div>
      <div>
        <FieldLabel>원하는 도메인 주소 (1~3순위)</FieldLabel>
        <TextArea value={data.desiredDomain} onChange={(v) => onChange({ desiredDomain: v })} placeholder="예: 1순위 ooclinic.com / 2순위 ooclinic.co.kr" rows={2} />
      </div>
      <div>
        <FieldLabel>SSL 인증서(https) 설치 여부</FieldLabel>
        <ChipSelector
          options={SSL_OPTIONS}
          selected={data.ssl ? [data.ssl] : []}
          onChange={(v) => onChange({ ssl: v[0] || '' })}
          multiple={false}
        />
      </div>

      {/* 기능 요구사항 */}
      <WebSubhead>⚙️ 기능 요구사항</WebSubhead>
      <div>
        <FieldLabel>필요한 기능</FieldLabel>
        <ChipSelector
          options={HOMEPAGE_FEATURES}
          selected={data.features}
          onChange={(v) => onChange({ features: v })}
        />
      </div>
      <div>
        <FieldLabel>홈페이지 직접 수정·관리 예정 여부</FieldLabel>
        <ChipSelector
          options={CMS_OPTIONS}
          selected={data.cmsNeed ? [data.cmsNeed] : []}
          onChange={(v) => onChange({ cmsNeed: v[0] || '' })}
          multiple={false}
        />
      </div>
      <div>
        <FieldLabel>기존 홈페이지 유무</FieldLabel>
        <ChipSelector
          options={RENEWAL_OPTIONS}
          selected={data.renewalType ? [data.renewalType] : []}
          onChange={(v) => onChange({ renewalType: v[0] || '' })}
          multiple={false}
        />
        {data.renewalType === '기존 홈페이지 있음(리뉴얼)' && (
          <div className="mt-2">
            <TextInput value={data.oldSiteUrl} onChange={(v) => onChange({ oldSiteUrl: v })} placeholder="기존 홈페이지 URL (예: https://기존홈페이지.com)" />
          </div>
        )}
      </div>

      {/* 일정/유지보수 */}
      <WebSubhead>📅 일정 / 유지보수</WebSubhead>
      <div>
        <FieldLabel>원하는 오픈 목표 일정</FieldLabel>
        <TextInput value={data.homepageDeadline} onChange={(v) => onChange({ homepageDeadline: v })} placeholder="예: 2026년 8월 말 오픈 희망" />
      </div>
      <div>
        <FieldLabel>오픈 후 유지보수 계약 희망 여부</FieldLabel>
        <ChipSelector
          options={MAINTENANCE_OPTIONS}
          selected={data.maintenance ? [data.maintenance] : []}
          onChange={(v) => onChange({ maintenance: v[0] || '' })}
          multiple={false}
        />
      </div>
    </div>
  );
}

// Step 7: 최종 확인
function SummarySection({
  title, stepIndex, onGoToStep, children,
}: {
  title: string; stepIndex: number; onGoToStep: (step: number) => void; children: React.ReactNode;
}) {
  return (
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
}

function SummaryItem({ label, value }: { label: string; value: string | undefined }) {
  if (!value || !value.trim()) return null;
  return (
    <div className="flex">
      <span className="w-24 flex-shrink-0 text-[#9CA3AF]">{label}</span>
      <span className="text-[#374151]">{value}</span>
    </div>
  );
}

function Step7({
  data, onGoToStep, confirmed, setConfirmed,
}: {
  data: FormData;
  onGoToStep: (step: number) => void;
  confirmed: boolean;
  setConfirmed: (v: boolean) => void;
}) {
  const { step1, step2, step3, step4, step5, stepWeb, step6 } = data;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-[#374151] mb-2">최종 확인</h2>

      {/* 강조 경고 박스 */}
      <div className="bg-[#FEF3C7] border-l-4 border-[#D97706] rounded-r-lg p-4">
        <p className="text-sm font-semibold text-[#92400E] mb-1">⚠️ 제출 전 마지막 확인</p>
        <p className="text-xs text-[#92400E] leading-relaxed">
          이대로 제출하면 노션 거래처 DB에 영구 기록되며, 다른 폼(계약변경·진료일정)이
          이 거래처와 연결될 때 <strong>여기 입력한 치과명을 정확히 따라야</strong> 매칭됩니다.
          오타·공백·괄호 흔들림은 나중에 일일이 수동으로 고쳐야 하니, 지금 한 번 더 봐주세요.
        </p>
      </div>

      <p className="text-sm text-[#6B7280] mb-4">
        각 섹션의 [수정] 버튼으로 해당 단계로 돌아갈 수 있습니다.
      </p>

      <SummarySection title="기본 정보" stepIndex={0} onGoToStep={onGoToStep}>
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
        {step1.doctors && step1.doctors.length > 0 && (
          <SummaryItem
            label="명단"
            value={step1.doctors
              .filter((d) => d.name || d.title || d.specialty)
              .map((d) => `${d.name || '미입력'} ${d.title}${d.specialty ? ` · ${d.specialty}` : ''}`)
              .join(' / ')}
          />
        )}
      </SummarySection>

      <SummarySection title="진료 정보" stepIndex={1} onGoToStep={onGoToStep}>
        <SummaryItem label="진료과목" value={step2.dentalSubjects.join(', ')} />
        <SummaryItem label="주력진료" value={step2.topSubjects.join(', ')} />
        {step2.alignerOptions && step2.alignerOptions.length > 0 && (
          <SummaryItem label="투명교정 브랜드" value={step2.alignerOptions.join(', ')} />
        )}
        {step2.pediatricOrthoOptions && step2.pediatricOrthoOptions.length > 0 && (
          <SummaryItem label="소아교정 장치" value={step2.pediatricOrthoOptions.join(', ')} />
        )}
        {Object.keys(step2.implantMaterials || {}).length > 0 && (
          <SummaryItem
            label="임플란트 재료"
            value={Object.entries(step2.implantMaterials)
              .map(([b, ps]) => (ps.length ? `${b} (${ps.join('/')})` : b))
              .join(', ')}
          />
        )}
        <SummaryItem label="공휴일" value={step2.holidayClose ? '휴진' : '진료'} />
        <SummaryItem label="점심시간" value={`${step2.lunchTime.start} ~ ${step2.lunchTime.end}`} />
      </SummarySection>

      <SummarySection title="시설/장비" stepIndex={2} onGoToStep={onGoToStep}>
        <SummaryItem label="체어 수" value={`${step3.chairs}대`} />
        <SummaryItem label="장비" value={step3.equipment.join(', ')} />
        <SummaryItem label="시설" value={step3.facilities.join(', ')} />
        <SummaryItem label="주차" value={step3.parking.detail ? `${step3.parking.available} (${step3.parking.detail})` : step3.parking.available} />
        <SummaryItem label="기공소" value={step3.hasLabRoom ? `보유${step3.labEquipment.length > 0 ? ` (${step3.labEquipment.join(', ')})` : ''}` : '미보유'} />
      </SummarySection>

      <SummarySection title="브랜딩 & 철학" stepIndex={3} onGoToStep={onGoToStep}>
        <SummaryItem label="한줄소개" value={step4.oneLiner} />
        <SummaryItem label="슬로건" value={step4.slogan} />
        <SummaryItem label="브랜드 비전" value={step4.brandVision} />
        <SummaryItem label="브랜드 톤" value={step4.brandTone} />
        <SummaryItem label="의료진 포인트" value={step4.doctorPromo} />
        <SummaryItem label="병원 포인트" value={step4.clinicPromo} />
        <SummaryItem label="주요 진료 포인트" value={step4.treatmentPromo} />
        <SummaryItem label="진료 철학" value={step4.philosophy} />
        <SummaryItem label="입지·타겟" value={step4.locationTarget} />
        <SummaryItem label="인테리어 컨셉" value={step4.interiorStyle} />
        <SummaryItem label="브랜드 컬러" value={step4.brandColor} />
      </SummarySection>

      <SummarySection title="마케팅 방향" stepIndex={4} onGoToStep={onGoToStep}>
        <SummaryItem label="유입경로" value={step5.referralSource.join(', ')} />
        <SummaryItem label="소개해 주신 분" value={step5.referralName} />
        <SummaryItem label="예산" value={step5.budgetRange} />
        <SummaryItem label="목표" value={step5.marketingGoals.join(', ')} />
        <SummaryItem label="채널" value={step5.desiredChannels.join(', ')} />
        <SummaryItem label="벤치마킹" value={step5.benchmarkClinics} />
        <SummaryItem label="개원이벤트" value={step5.openingEvent} />
        <SummaryItem label="DID 정보" value={step5.didInfo} />
        <SummaryItem label="리뷰 증정선물" value={step5.reviewGift} />
        <SummaryItem label="채널 증정선물" value={step5.channelGift} />
      </SummarySection>

      <SummarySection title="홈페이지/웹" stepIndex={5} onGoToStep={onGoToStep}>
        <SummaryItem label="오시는 길" value={[stepWeb.subway, stepWeb.bus, stepWeb.locationNote].filter(Boolean).join(' / ')} />
        <SummaryItem label="원장 약력" value={[stepWeb.education, stepWeb.career].filter(Boolean).join(' / ')} />
        <SummaryItem label="메인 키워드" value={stepWeb.mainKeywords} />
        <SummaryItem label="참고 사이트" value={stepWeb.referenceSites} />
        <SummaryItem label="도메인" value={stepWeb.desiredDomain} />
        <SummaryItem label="SSL" value={stepWeb.ssl} />
        <SummaryItem label="필요 기능" value={(stepWeb.features || []).join(', ')} />
        <SummaryItem label="리뉴얼" value={stepWeb.renewalType} />
        <SummaryItem label="오픈 일정" value={stepWeb.homepageDeadline} />
      </SummarySection>

      <SummarySection title="계약 상품" stepIndex={6} onGoToStep={onGoToStep}>
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
      </SummarySection>

      {/* 확인 게이트: 체크해야 제출 활성화 */}
      <label className="flex items-start gap-3 bg-white rounded-xl border-2 border-[#2563EB] p-4 cursor-pointer hover:bg-[#EFF6FF] transition-colors">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-0.5 w-5 h-5 accent-[#2563EB] flex-shrink-0"
        />
        <div className="text-sm">
          <span className="font-semibold text-[#374151]">위 내용을 모두 확인했습니다.</span>
          <p className="text-xs text-[#6B7280] mt-1 leading-relaxed">
            치과명·원장명·전화번호·주소가 정확한지, 오타나 공백 흔들림이 없는지 한 번 더 봐주세요.
          </p>
        </div>
      </label>
    </div>
  );
}
