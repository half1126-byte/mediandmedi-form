/** Strip retired answers even when an old draft or direct request still contains them. */
export function sanitizeRetiredFormFields(data: Record<string, unknown>): Record<string, unknown> {
  const result = { ...data };
  const retired: Record<string, string[]> = {
    step1: ['fax'], step3: ['interiorStyle', 'equipmentDetail'], step4: ['interiorStyle', 'mainEmphasis'],
    step5: ['budgetRange'], stepWeb: ['mainEmphasis', 'reviewer', 'features', 'menuStructure', 'mustHavePages'], stepDesign: ['videoBgm'], accounts: ['domain'],
  };
  for (const [step, fields] of Object.entries(retired)) {
    const value = data[step];
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const copy = { ...value } as Record<string, unknown>;
    for (const field of fields) delete copy[field];
    result[step] = copy;
  }
  const basic = result.step1 as Record<string, unknown> | undefined;
  if (basic && Array.isArray(basic.doctors)) {
    basic.doctors = basic.doctors.map((doctor: Record<string, unknown>) => {
      const { specialty, ...rest } = doctor;
      // 현재 폼과 동일하게 기존 전문분야는 경력/전문의 자격에 합친다.
      if (typeof specialty === 'string' && specialty.trim()) {
        const career = typeof rest.career === 'string' ? rest.career : '';
        rest.career = career.includes(specialty) ? career : [career, specialty].filter(Boolean).join('\n');
      }
      return rest;
    });
  }
  const facilities = result.step3 as Record<string, unknown> | undefined;
  if (facilities && Array.isArray(facilities.equipment)) {
    facilities.equipment = facilities.equipment.filter(value => !['유니트체어', '임플란트 엔진', '없음'].includes(value));
    if (facilities.equipmentModels && typeof facilities.equipmentModels === 'object') {
      const models = { ...facilities.equipmentModels } as Record<string, unknown>;
      delete models['없음']; delete models['유니트체어']; delete models['임플란트 엔진'];
      facilities.equipmentModels = models;
    }
  }
  // 계약 범위 밖의 이전 작성값은 저장하지 않는다. 공통 자료/색상은 유지한다.
  const scope = data.scope as Record<string, boolean> | undefined;
  if (scope) {
    const marketingOff = scope.marketing === false && scope.viral === false;
    const webOff = scope.web === false;
    if (marketingOff) {
      const marketing = result.step5 as Record<string, unknown> | undefined;
      result.step5 = { additionalRequest: marketing?.additionalRequest };
    }
    if (webOff) {
      const web = result.stepWeb as Record<string, unknown> | undefined;
      result.stepWeb = { photoTypes: web?.photoTypes };
      for (const key of ['step4', 'step5']) {
        const value = result[key] as Record<string, unknown> | undefined;
        if (value) { result[key] = { ...value }; delete (result[key] as Record<string, unknown>).benchmarkClinics; }
      }
    }
    const design = { ...(result.stepDesign as Record<string, unknown> || {}) };
    if (scope.logo === false) for (const key of ['logoType', 'logoNotation', 'englishSpelling', 'logoMotif']) delete design[key];
    if (scope.video === false) for (const key of ['videoMessage', 'videoReference', 'videoChannels', 'videoItems']) delete design[key];
    result.stepDesign = design;
    const accounts = { ...(result.accounts as Record<string, unknown> || {}) };
    if (marketingOff) for (const key of ['naver', 'google', 'kakao', 'dentalAd', 'instagram', 'youtube', 'danggeun', 'blog']) delete accounts[key];
    if (webOff) for (const key of ['hosting', 'ftp', 'admin']) delete accounts[key];
    result.accounts = accounts;
  }
  return result;
}
