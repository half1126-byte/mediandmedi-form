import { expect, it } from 'vitest';
import { webRequiredComplete, webFeaturesComplete } from '../../src/lib/web-required';
it('requires web answers except optional directions and pages and accepts none and undecided', () => {
  const data = { desiredDomain: 'clinic.co.kr', ssl: '미설치', homepageDeadline: '12월 중', maintenance: '미정', features: ['온라인 예약 시스템'], cmsNeed: '미정', renewalType: '신규 제작', feedbackChannel: '카카오톡' };
  expect(webRequiredComplete(data)).toBe(true);
  expect(webRequiredComplete({ ...data, subway: '', bus: '', locationNote: '' })).toBe(true);
  for (const key of Object.keys(data).filter(key => key !== 'features')) expect(webRequiredComplete({ ...data, [key]: '  ' })).toBe(false);
  expect(webRequiredComplete({ ...data, features: [] })).toBe(true);
  expect(webRequiredComplete({ ...data, features: undefined })).toBe(true);
  expect(webRequiredComplete()).toBe(false);
  expect(webRequiredComplete({ ...data, ssl: 'invalid' })).toBe(false);
  expect(webRequiredComplete({ ...data, maintenance: 'invalid' })).toBe(false);
});

it('accepts consultation as an exclusive feature answer', () => {
  const data = { features: ['상담 후 결정'], cmsNeed: '미정', renewalType: '신규 제작', feedbackChannel: '카카오톡' };
  expect(webFeaturesComplete(data)).toBe(true);
  expect(webFeaturesComplete({ ...data, feedbackChannel: '' })).toBe(false);
  expect(webFeaturesComplete({ ...data, features: ['상담 후 결정', '온라인 예약 시스템'] })).toBe(true);
});
