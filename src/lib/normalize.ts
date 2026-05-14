/**
 * 거래처명 표기 흔들림 보정용 안전 정규화.
 *
 * 무엇을 잡나:
 * - 앞뒤 공백 ("  OO치과  " → "OO치과")
 * - 내부 다중 공백 ("OO  치과" → "OO 치과")
 * - 전각/반각 공백 혼용 (전각 공백 　 → 일반 공백)
 *
 * 무엇을 안 잡나 (false positive 위험):
 * - "OO치과" vs "OO 치과" (공백 유무 — 운영자가 정한 표기를 존중)
 * - "OO치과" vs "OO치과의원" (접미사 차이)
 * - "OO치과" vs "오오치과" (한글 표기 차이)
 *
 * 이 함수는 매칭 비교용으로만 사용. 노션에 저장하는 값에는 적용하지 않음
 * (사용자가 입력한 그대로 저장하는 게 안전).
 */
export function normalizeClinicName(name: string): string {
  if (!name) return '';
  return name
    .replace(/　/g, ' ')      // 전각 공백 → 일반 공백
    .replace(/\s+/g, ' ')          // 다중 공백 → 단일 공백
    .trim();
}

/**
 * 거래처명 매칭 — 양쪽 다 정규화 후 비교.
 * 노션 페이지 검색 결과 필터링에 사용.
 */
export function clinicNamesMatch(a: string, b: string): boolean {
  return normalizeClinicName(a) === normalizeClinicName(b);
}
