import { describe, it, expect } from 'vitest';
import { normalizeClinicName, clinicNamesMatch } from '@/lib/normalize';

describe('normalizeClinicName', () => {
  it('빈 문자열 → 빈 문자열', () => {
    expect(normalizeClinicName('')).toBe('');
  });

  it('앞뒤 공백 제거', () => {
    expect(normalizeClinicName('  OO치과  ')).toBe('OO치과');
  });

  it('내부 다중 공백 → 단일 공백', () => {
    expect(normalizeClinicName('OO  치과')).toBe('OO 치과');
    expect(normalizeClinicName('OO   의원')).toBe('OO 의원');
  });

  it('전각 공백 → 반각 공백', () => {
    expect(normalizeClinicName('OO　치과')).toBe('OO 치과');
  });

  it('전각·반각·다중 공백 혼합', () => {
    expect(normalizeClinicName('  OO　 치과  의원 ')).toBe('OO 치과 의원');
  });

  it('정상 입력은 그대로', () => {
    expect(normalizeClinicName('OO치과')).toBe('OO치과');
    expect(normalizeClinicName('OO 치과의원')).toBe('OO 치과의원');
  });

  it('공백 유무는 다르게 취급 (false positive 방지)', () => {
    expect(normalizeClinicName('OO치과')).not.toBe(normalizeClinicName('OO 치과'));
  });

  it('접미사 차이는 다르게 취급 (치과 vs 치과의원)', () => {
    expect(normalizeClinicName('OO치과')).not.toBe(normalizeClinicName('OO치과의원'));
  });
});

describe('clinicNamesMatch', () => {
  it('완전 동일은 매칭', () => {
    expect(clinicNamesMatch('OO치과', 'OO치과')).toBe(true);
  });

  it('앞뒤 공백 차이는 매칭 (정규화 후 동일)', () => {
    expect(clinicNamesMatch('  OO치과  ', 'OO치과')).toBe(true);
  });

  it('다중 공백 차이는 매칭', () => {
    expect(clinicNamesMatch('OO  치과', 'OO 치과')).toBe(true);
  });

  it('전각 공백 vs 반각 공백 매칭', () => {
    expect(clinicNamesMatch('OO　치과', 'OO 치과')).toBe(true);
  });

  it('공백 유무가 다르면 불일치 (정규화하지 않음)', () => {
    expect(clinicNamesMatch('OO치과', 'OO 치과')).toBe(false);
  });

  it('접미사 다르면 불일치', () => {
    expect(clinicNamesMatch('OO치과', 'OO치과의원')).toBe(false);
  });

  it('빈 문자열 둘 다는 매칭', () => {
    expect(clinicNamesMatch('', '')).toBe(true);
  });
});
