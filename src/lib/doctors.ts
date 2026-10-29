export interface Doctor {
  name: string;
  title: string;
  specialty: string;
  education?: string;
  career?: string;
  associations?: string;
  awards?: string;
}

/**
 * 의료진 카드의 대표 원장(첫 번째) 성함칸은 비워두면 화면에 '원장님 성함'(doctorName)이 대신 표시된다.
 * 화면에 보인 그대로 확인·저장되도록 비어 있으면 doctorName으로 채운다. (안 그러면 노션에 "미입력"으로 저장됨)
 */
export function resolveDoctors(doctors: Doctor[] | undefined, doctorName: string | undefined): Doctor[] {
  return (doctors || []).map((d, i) =>
    i === 0 && !d.name?.trim() && doctorName?.trim() ? { ...d, name: doctorName.trim() } : d
  );
}

export function doctorProfilesComplete(doctors: Doctor[], count: number, legacy: { education?: string; career?: string }, doctorName?: string): boolean {
  const filled = (value: unknown) => typeof value === 'string' && !!value.trim();
  return Number.isInteger(count) && count >= 1 && count <= 20 && doctors.length === count && doctors.every((d, i) =>
    d && filled(d.name || (i === 0 ? doctorName : '')) &&
    filled(d.education ?? (i === 0 ? legacy.education : '')) &&
    filled(d.career ?? (i === 0 ? legacy.career : '')));
}
