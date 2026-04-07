import { describe, it, expect } from 'vitest';
import {
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
  step5Schema,
  step6Schema,
  fullFormSchema,
  contractChangeSchema,
} from '@/lib/schema';

describe('step1Schema', () => {
  it('유효한 데이터 통과', () => {
    const result = step1Schema.safeParse({
      clinicName: '해피스마일치과',
      doctorName: '김행복',
      openDate: '2026-05-01',
      region: { city: '서울특별시', district: '강남구', dong: '역삼동' },
      address: '역삼동 123-4',
    });
    expect(result.success).toBe(true);
  });

  it('치과명 누락 시 실패', () => {
    const result = step1Schema.safeParse({
      clinicName: '',
      doctorName: '김행복',
      openDate: '2026-05-01',
      region: { city: '서울특별시', district: '강남구' },
    });
    expect(result.success).toBe(false);
  });

  it('원장명 누락 시 실패', () => {
    const result = step1Schema.safeParse({
      clinicName: '해피치과',
      doctorName: '',
      openDate: '2026-05-01',
      region: { city: '서울특별시', district: '강남구' },
    });
    expect(result.success).toBe(false);
  });

  it('동은 선택사항', () => {
    const result = step1Schema.safeParse({
      clinicName: '해피치과',
      doctorName: '김행복',
      openDate: '2026-05-01',
      region: { city: '서울특별시', district: '강남구' },
    });
    expect(result.success).toBe(true);
  });
});

describe('step2Schema', () => {
  const validStep2 = {
    dentalSubjects: ['충치치료', '임플란트'],
    topSubjects: ['충치치료'],
    schedule: {
      '월': { enabled: true, start: '09:00', end: '18:00' },
    },
    holidays: [],
    holidayClose: true,
    lunchTime: { start: '12:00', end: '13:00' },
  };

  it('유효한 데이터 통과', () => {
    expect(step2Schema.safeParse(validStep2).success).toBe(true);
  });

  it('진료과목 빈 배열 시 실패', () => {
    const result = step2Schema.safeParse({
      ...validStep2,
      dentalSubjects: [],
    });
    expect(result.success).toBe(false);
  });

  it('주력진료 4개 초과 시 실패', () => {
    const result = step2Schema.safeParse({
      ...validStep2,
      topSubjects: ['a', 'b', 'c', 'd'],
    });
    expect(result.success).toBe(false);
  });
});

describe('step3Schema', () => {
  it('체어수 범위 검증 (1~30)', () => {
    expect(step3Schema.safeParse({
      chairs: 0,
      equipment: [],
      facilities: [],
      parking: { available: '가능' },
    }).success).toBe(false);

    expect(step3Schema.safeParse({
      chairs: 31,
      equipment: [],
      facilities: [],
      parking: { available: '가능' },
    }).success).toBe(false);

    expect(step3Schema.safeParse({
      chairs: 5,
      equipment: ['CT(CBCT)'],
      facilities: ['수술실'],
      parking: { available: '가능' },
    }).success).toBe(true);
  });

  it('주차 옵션 enum 검증', () => {
    expect(step3Schema.safeParse({
      chairs: 5,
      equipment: [],
      facilities: [],
      parking: { available: '잘못된값' },
    }).success).toBe(false);
  });
});

describe('step4Schema', () => {
  it('모든 필드 선택사항 (빈 객체 통과)', () => {
    const result = step4Schema.safeParse({
      hasProfilePhoto: false,
    });
    expect(result.success).toBe(true);
  });
});

describe('step5Schema', () => {
  it('마케팅목표 3개 초과 시 실패', () => {
    const result = step5Schema.safeParse({
      referralSource: [],
      marketingGoals: ['a', 'b', 'c', 'd'],
      desiredChannels: [],
    });
    expect(result.success).toBe(false);
  });
});

describe('step6Schema', () => {
  it('서비스 배열 검증', () => {
    const result = step6Schema.safeParse({
      services: [{ serviceId: 'cafe-viral', quantity: 10 }],
      isStarterPackage: false,
    });
    expect(result.success).toBe(true);
  });
});

describe('fullFormSchema', () => {
  it('전체 유효 데이터 통과', () => {
    const data = {
      step1: {
        clinicName: '해피치과',
        doctorName: '김행복',
        openDate: '2026-05-01',
        region: { city: '서울특별시', district: '강남구' },
      },
      step2: {
        dentalSubjects: ['충치치료'],
        topSubjects: [],
        schedule: {},
        holidays: [],
        holidayClose: false,
        lunchTime: { start: '12:00', end: '13:00' },
      },
      step3: {
        chairs: 3,
        equipment: [],
        facilities: [],
        parking: { available: '가능' },
      },
      step4: { hasProfilePhoto: false },
      step5: {
        referralSource: [],
        marketingGoals: [],
        desiredChannels: [],
      },
      step6: {
        services: [],
        isStarterPackage: false,
      },
    };
    expect(fullFormSchema.safeParse(data).success).toBe(true);
  });
});

describe('contractChangeSchema', () => {
  it('유효한 계약변경 통과', () => {
    const result = contractChangeSchema.safeParse({
      clinicName: '해피치과',
      doctorName: '김행복',
      currentServices: ['카페바이럴'],
      addServices: ['블로그작성(임상)'],
      removeServices: [],
      reason: '마케팅 채널 확대',
    });
    expect(result.success).toBe(true);
  });

  it('사유 누락 시 실패', () => {
    const result = contractChangeSchema.safeParse({
      clinicName: '해피치과',
      doctorName: '김행복',
      currentServices: ['카페바이럴'],
      addServices: [],
      removeServices: [],
      reason: '',
    });
    expect(result.success).toBe(false);
  });

  it('현재 상품 빈 배열 시 실패', () => {
    const result = contractChangeSchema.safeParse({
      clinicName: '해피치과',
      doctorName: '김행복',
      currentServices: [],
      addServices: [],
      removeServices: [],
      reason: '테스트',
    });
    expect(result.success).toBe(false);
  });
});
