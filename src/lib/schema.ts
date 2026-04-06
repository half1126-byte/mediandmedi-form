import { z } from 'zod';

// Step 1: 기본 정보
export const step1Schema = z.object({
  clinicName: z.string().min(1, '치과명을 입력해주세요'),
  doctorName: z.string().min(1, '원장님 성함을 입력해주세요'),
  openDate: z.string().min(1, '개원예정일을 선택해주세요'),
  region: z.object({
    city: z.string().min(1, '시/도를 선택해주세요'),
    district: z.string().min(1, '구/군을 선택해주세요'),
    dong: z.string().optional(),
  }),
  address: z.string().optional(),
});

// Step 2: 진료 정보
export const step2Schema = z.object({
  dentalSubjects: z.array(z.string()).min(1, '진료과목을 선택해주세요'),
  topSubjects: z.array(z.string()).max(3, '주력진료는 최대 3개까지'),
  schedule: z.record(z.string(), z.object({
    enabled: z.boolean(),
    start: z.string(),
    end: z.string(),
  })),
  holidays: z.array(z.string()),
  holidayClose: z.boolean(),
  lunchTime: z.object({
    start: z.string(),
    end: z.string(),
  }),
  nightWeekend: z.string().optional(),
});

// Step 3: 시설/장비
export const step3Schema = z.object({
  chairs: z.number().min(1).max(30),
  equipment: z.array(z.string()),
  facilities: z.array(z.string()),
  parking: z.object({
    available: z.enum(['가능', '불가', '발렛', '기타']),
    detail: z.string().optional(),
  }),
  interiorStyle: z.string().optional(),
});

// Step 4: 브랜딩 & 철학
export const step4Schema = z.object({
  oneLiner: z.string().optional(),
  philosophy: z.string().optional(),
  targetPatients: z.string().optional(),
  differentiator: z.string().optional(),
  doctorCareer: z.string().optional(),
  hasProfilePhoto: z.boolean(),
});

// Step 5: 마케팅 방향
export const step5Schema = z.object({
  referralSource: z.array(z.string()),
  previousMarketing: z.string().optional(),
  budgetRange: z.string().optional(),
  marketingGoals: z.array(z.string()).max(3),
  desiredChannels: z.array(z.string()),
  additionalRequest: z.string().optional(),
});

// Step 6: 계약 상품
export const step6Schema = z.object({
  services: z.array(z.object({
    serviceId: z.string(),
    quantity: z.number().optional(),
  })),
  isStarterPackage: z.boolean(),
  contractStartDate: z.string().optional(),
  monthlyFee: z.string().optional(),
  specialNotes: z.string().optional(),
});

// 전체 폼 스키마
export const fullFormSchema = z.object({
  step1: step1Schema,
  step2: step2Schema,
  step3: step3Schema,
  step4: step4Schema,
  step5: step5Schema,
  step6: step6Schema,
});

export type FullFormData = z.infer<typeof fullFormSchema>;

// 계약변경 스키마
export const contractChangeSchema = z.object({
  clinicName: z.string().min(1, '치과명을 입력해주세요'),
  doctorName: z.string().min(1, '원장님 성함을 입력해주세요'),
  currentServices: z.array(z.string()).min(1, '현재 계약 상품을 선택해주세요'),
  addServices: z.array(z.string()),
  removeServices: z.array(z.string()),
  reason: z.string().min(1, '변경 사유를 입력해주세요'),
});

export type ContractChangeData = z.infer<typeof contractChangeSchema>;
