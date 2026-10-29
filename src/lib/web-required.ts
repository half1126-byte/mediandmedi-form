import { CMS_OPTIONS, RENEWAL_OPTIONS, FEEDBACK_CHANNELS } from '../data/dental';
type WebInfo = { desiredDomain?: string; ssl?: string; subway?: string; bus?: string; locationNote?: string; homepageDeadline?: string; maintenance?: string; features?: string[]; cmsNeed?: string; renewalType?: string; menuStructure?: string[]; mustHavePages?: string; reviewer?: string; feedbackChannel?: string };
const filled = (value: unknown) => typeof value === 'string' && !!value.trim();
export function webDirectionsComplete(data?: WebInfo): boolean {
  return [data?.subway, data?.bus, data?.locationNote].every(filled);
}
export function webScheduleComplete(data?: WebInfo): boolean {
  return filled(data?.homepageDeadline) && ['희망함', '희망하지 않음', '미정'].includes(data?.maintenance || '');
}
export function webFeaturesComplete(data?: WebInfo): boolean {
  return CMS_OPTIONS.includes(data?.cmsNeed || '') && RENEWAL_OPTIONS.includes(data?.renewalType || '')
    && FEEDBACK_CHANNELS.includes(data?.feedbackChannel || '');
}
export function webDomainComplete(data?: WebInfo): boolean {
  return filled(data?.desiredDomain) && ['설치됨', '미설치', '모름'].includes(data?.ssl || '');
}
export function webRequiredComplete(data?: WebInfo): boolean {
  return webScheduleComplete(data) && webFeaturesComplete(data) && webDomainComplete(data);
}
