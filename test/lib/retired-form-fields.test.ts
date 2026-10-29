import { it, expect } from 'vitest';
import { sanitizeRetiredFormFields } from '@/lib/retired-form-fields';
it.each(['web', 'marketing'])('excludes stale package answers for %s contracts', (preset) => {
 const web = preset === 'web';
 const data = { scope: { web, marketing: !web, viral: !web, logo: false, video: false }, step5: { marketingGoals: ['목표'], additionalRequest: '요청' }, stepWeb: { desiredDomain: 'clinic.example', photoTypes: ['로고'] }, stepDesign: { logoType: '심볼', videoMessage: '영상', avoidColor: '빨강' }, accounts: { naver: { id: 'naver' }, admin: { id: 'admin' } } };
 const clean = sanitizeRetiredFormFields(data);
 expect(clean.step5).toEqual(web ? { additionalRequest: '요청' } : data.step5);
 expect(clean.stepWeb).toEqual(web ? data.stepWeb : { photoTypes: ['로고'] });
 expect(clean.stepDesign).toEqual({ avoidColor: '빨강' });
 expect(clean.accounts).toEqual(web ? { admin: { id: 'admin' } } : { naver: { id: 'naver' } });
 expect(data.stepDesign.videoMessage).toBe('영상');
});
it('excludes removed fields from legacy payloads without mutating drafts', () => {
 const data = { step1: { fax: 'old', phone: 'keep' }, step3: { interiorStyle: 'old', equipment: ['유니트체어', '임플란트 엔진', '치과용 CT'], equipmentModels: { 유니트체어: 'old', '치과용 CT': 'keep' } }, step4: { interiorStyle: 'old', mainEmphasis: 'old', brandVision: 'keep', photoDirection: 'keep' }, step5: { budgetRange: 'old', marketingGoals: ['keep'] }, stepWeb: { mainEmphasis: 'old', reviewer: 'old', desiredDomain: 'keep', referenceSites: 'keep' }, stepDesign: { videoBgm: 'old', videoMessage: 'keep' }, accounts: { domain: { id: 'old' }, hosting: { id: 'keep' } } };
 const clean = sanitizeRetiredFormFields(data);
 expect(clean.step1).toEqual({ phone: 'keep' });
 expect(clean.step3).toEqual({ equipment: ['치과용 CT'], equipmentModels: { '치과용 CT': 'keep' } });
 expect(clean.step4).toEqual({ brandVision: 'keep', photoDirection: 'keep' });
 expect(clean.step5).toEqual({ marketingGoals: ['keep'] });
 expect(clean.stepWeb).toEqual({ desiredDomain: 'keep', referenceSites: 'keep' });
 expect(clean.stepDesign).toEqual({ videoMessage: 'keep' });
 expect(clean.accounts).toEqual({ hosting: { id: 'keep' } });
 expect(data.step3.equipment).toHaveLength(3);
 expect(data.step1.fax).toBe('old');
});
