export interface Doctor {
  name: string;
  title: string;
  specialty: string;
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
