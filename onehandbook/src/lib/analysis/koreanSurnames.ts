/**
 * 한국 성씨 사전 — 통계청 2015 인구주택총조사 빈도 상위 ~100건.
 * 한글 1글자 (단성) + 2글자 (복성) 분리.
 *
 * ADR-0029 정합:
 * - 외부 의존 0 (인라인 상수, 모듈 단독 export).
 * - mention 앞 1-2글자 strip 후 given-name suffix 매칭 path 사용.
 * - 미커버 성씨 / 외국식 이름 = strip 비대상 = Haiku 가 brief 컨텍스트 판단.
 */
export const KOREAN_SURNAMES_DOUBLE: ReadonlySet<string> = new Set([
  "남궁",
  "황보",
  "제갈",
  "사공",
  "선우",
  "서문",
  "독고",
]);

export const KOREAN_SURNAMES_SINGLE: ReadonlySet<string> = new Set([
  "김", "이", "박", "최", "정", "강", "조", "윤", "장", "임",
  "한", "오", "서", "신", "권", "황", "안", "송", "류", "전",
  "홍", "고", "문", "양", "손", "배", "백", "허", "유", "남",
  "심", "노", "하", "곽", "성", "차", "주", "우", "구", "민",
  "라", "진", "지", "엄", "채", "원", "천", "방", "공", "현",
  "함", "변", "염", "여", "추", "도", "소", "석", "선", "설",
  "마", "길", "연", "위", "표", "명", "기", "반", "왕", "금",
  "옥", "육", "인", "맹", "제", "모", "탁", "국", "어", "은",
  "편", "용", "예", "경", "봉", "사", "부", "가", "복", "태",
  "목", "형", "피", "두", "감", "음", "빈",
]);

/**
 * mention 안에서 성씨 strip 결과 (given-name 부분) 반환.
 * - 첫 2글자가 복성 = strip 2글자
 * - 첫 1글자가 단성 = strip 1글자
 * - 둘 다 부재 = null (호칭/별호 path = Haiku 판단 대상)
 */
export function stripKoreanSurname(mention: string): string | null {
  const m = mention.trim();
  if (m.length < 2) return null;
  if (m.length >= 3 && KOREAN_SURNAMES_DOUBLE.has(m.slice(0, 2))) {
    return m.slice(2).trim() || null;
  }
  if (KOREAN_SURNAMES_SINGLE.has(m.slice(0, 1))) {
    return m.slice(1).trim() || null;
  }
  return null;
}
