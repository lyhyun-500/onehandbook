/**
 * 점수 컬러 시스템 — 시안 README "Score color system" 박음 그대로.
 * 페이즈 2-B (LiveScoreCard) + 페이즈 4 (Analysis Report) 박음 재사용.
 *
 * <60 = bg 미박음 (시안 명시) — 호출처 결정 박음 (예: 막대그래프 fill 박지 않거나 별도 톤).
 */
export interface ScoreColorTokens {
  /** Text class (점수 숫자, 라벨 등) */
  text: string;
  /** Background class (막대그래프 fill, 칩 배경 등). <60 은 미박음 — 호출처 결정. */
  bg?: string;
}

export function getScoreColor(score: number): ScoreColorTokens {
  if (score >= 90) {
    return { text: "text-emerald-300", bg: "bg-emerald-400/80" };
  }
  if (score >= 80) {
    return { text: "text-amber-200", bg: "bg-amber-300/80" };
  }
  if (score >= 70) {
    return { text: "text-amber-300/90", bg: "bg-amber-400/60" };
  }
  if (score >= 60) {
    return { text: "text-orange-300/90", bg: "bg-orange-400/60" };
  }
  return { text: "text-rose-300/80" };
}
