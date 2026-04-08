import type { HolisticAnalysisResult } from "@/lib/ai/types";

export type HolisticChartPoint = {
  episode_number: number;
  label: string;
  score: number;
  charCount: number;
};

/**
 * 회차별 글자 수로 episode_scores를 가중해 종합 점수를 맞추고,
 * 차트용 포인트를 만듭니다.
 */
export function buildHolisticDisplay(
  result: HolisticAnalysisResult,
  orderedEpisodes: Array<{
    episode_number: number;
    title: string;
    charCount: number;
  }>
): {
  weightedOverall: number;
  chartPoints: HolisticChartPoint[];
} {
  const scoreByEp = new Map<number, number>();
  for (const es of result.episode_scores) {
    scoreByEp.set(es.episode_number, es.score);
  }

  const chartPoints: HolisticChartPoint[] = [];
  let num = 0;
  let den = 0;

  for (const ep of orderedEpisodes) {
    const sc = scoreByEp.get(ep.episode_number);
    if (sc == null) continue;
    /** UI에서 charCount가 0으로만 넘어와도 LLM 점수는 있을 수 있어 최소 가중 1 */
    const weight = ep.charCount > 0 ? ep.charCount : 1;
    num += sc * weight;
    den += weight;
    chartPoints.push({
      episode_number: ep.episode_number,
      label: `${ep.episode_number}화`,
      score: sc,
      charCount: ep.charCount,
    });
  }

  const weightedOverall =
    den > 0 ? Math.round(num / den) : result.overall_score;

  return { weightedOverall, chartPoints };
}
