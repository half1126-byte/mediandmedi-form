import { describe, expect, it } from 'vitest';
import { doctorProfilesComplete } from '@/lib/doctors';

describe('의료진별 필수 약력', () => {
  const main = { name: '김원장', title: '원장', specialty: '' };
  const legacy = { education: '기존 학력', career: '기존 경력' };
  it('기존 공통 약력은 대표원장에게만 적용한다', () => {
    expect(doctorProfilesComplete([main], 1, legacy)).toBe(true);
    expect(doctorProfilesComplete([main, { ...main, name: '이원장' }], 2, legacy)).toBe(false);
  });
  it('추가 의료진도 학력과 경력을 모두 입력해야 한다', () => {
    const second = { ...main, name: '이원장', education: '별도 학력', career: '별도 경력' };
    expect(doctorProfilesComplete([main, second], 2, legacy)).toBe(true);
    expect(doctorProfilesComplete([main, { ...second, career: ' ' }], 2, legacy)).toBe(false);
  });
  it('지운 값에 기존 약력을 다시 채우지 않고 인원수도 확인한다', () => {
    expect(doctorProfilesComplete([{ ...main, education: '' }], 1, legacy)).toBe(false);
    expect(doctorProfilesComplete([main], 2, legacy)).toBe(false);
  });
});
