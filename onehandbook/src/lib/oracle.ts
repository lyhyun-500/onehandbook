/** reader_actions 행으로 작품별 Agent Score(정주행률 평균, 0~100) 계산 — 레거시 집계 */
export function computeOracleScores(
  actions: { work_id: number; completion_rate: number | string }[] | null
): Record<number, number> {
  const sumByWork: Record<number, { sum: number; count: number }> = {};
  (actions ?? []).forEach((a) => {
    if (!sumByWork[a.work_id]) {
      sumByWork[a.work_id] = { sum: 0, count: 0 };
    }
    sumByWork[a.work_id].sum += Number(a.completion_rate);
    sumByWork[a.work_id].count += 1;
  });
  const out: Record<number, number> = {};
  Object.entries(sumByWork).forEach(([workId, { sum, count }]) => {
    out[Number(workId)] = Math.round(sum / count);
  });
  return out;
}
