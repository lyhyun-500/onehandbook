/**
 * 분석 영역 한정 4단계 점수 색 — 시안 work-analysis.jsx line 57-64 정합.
 *
 * 기존 `getScoreColor` (`src/lib/scoreColor.ts`) 는 5단계 본질 (90+/80+/70+/60+/<60) 로
 * studio LiveScoreCard / ScoreText atom 등 다른 사용처에서 사용 중 — 보존.
 *
 * 본 utility 는 분석 영역 (work-analysis + holistic-report) 전용.
 * LEE 결정 Z1 (b) — 별 함수 신설, 다른 사용처 영향 0.
 */
export function getAnalysisScoreColor(
  score: number | null | undefined,
): string {
  if (score == null) return "text-stone-600";
  if (score >= 88) return "text-emerald-300";
  if (score >= 80) return "text-amber-200";
  if (score >= 72) return "text-amber-300/90";
  return "text-rose-300/80";
}
