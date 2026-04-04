/** 분석 최소 글자 수 (미만이면 분석 불가) */
export const MIN_ANALYSIS_CHARS = 500;

/** 이 글자 수 미만이면 ‘원고량 적음’ 경고 (500자 이상 1000자 미만) */
export const MIN_COMFORT_CHARS = 1000;

export type ManuscriptAnalysisTier = "blocked" | "low" | "ok";

export function getManuscriptAnalysisTier(
  charCount: number
): ManuscriptAnalysisTier {
  const n = Math.max(0, charCount);
  if (n < MIN_ANALYSIS_CHARS) return "blocked";
  if (n < MIN_COMFORT_CHARS) return "low";
  return "ok";
}

export const MANUSCRIPT_TOO_SHORT_MESSAGE =
  "분석하기에 원고량이 부족합니다. 최소 500자 이상 입력해주세요.";

export const MANUSCRIPT_LOW_VOLUME_WARNING =
  "원고량이 적어 분석 정확도가 낮을 수 있습니다. 계속하시겠습니까?";
