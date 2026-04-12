import type { AnalysisResult, HolisticAnalysisResult } from "@/lib/ai/types";

/** 작품 단위 통합 일괄 분석 1건 */
export type HolisticRunRow = {
  id: number;
  work_id: number;
  episode_ids: number[];
  agent_version: string;
  result_json: HolisticAnalysisResult;
  nat_cost: number;
  created_at: string;
};

export type AnalysisRunRow = {
  id: number;
  episode_id: number;
  /** 집계·탐색용; 단일 작품 조회에서는 생략 가능 */
  work_id?: number;
  agent_version: string;
  result_json: AnalysisResult;
  created_at: string;
  /** 통합 일괄 분석 동기화 행 여부 (`syncPerEpisodeAnalysisFromHolisticRun`) */
  options_json?: Record<string, unknown> | null;
};

/** created_at 내림차순으로 정렬된 runs에서 회차별 최신 1건 */
export function latestAnalysisPerEpisode(
  runs: AnalysisRunRow[]
): Map<number, AnalysisRunRow> {
  const map = new Map<number, AnalysisRunRow>();
  for (const r of runs) {
    if (!map.has(r.episode_id)) {
      map.set(r.episode_id, r);
    }
  }
  return map;
}

/** 최신 회차별 종합 점수의 산술 평균 (분석 없으면 null) */
export function averageOverallScore(
  latest: Map<number, AnalysisRunRow>
): number | null {
  const scores = [...latest.values()].map((r) => r.result_json.overall_score);
  if (scores.length === 0) return null;
  return Math.round(
    scores.reduce((a, b) => a + b, 0) / scores.length
  );
}

/**
 * Agent Score 표시용: 해당 작품에서 분석 기록이 있는 회차(회차별 최신 1건)의
 * 종합 점수 산술 평균. 분석이 하나도 없으면 null.
 */
export function agentScoreFromAnalysisRuns(
  runs: AnalysisRunRow[]
): number | null {
  const latest = latestAnalysisPerEpisode(runs);
  return averageOverallScore(latest);
}

/** 여러 작품의 runs를 한 번에 넘겨 작품 id → Agent Score 맵 */
export function agentScoresByWorkFromRuns(
  runs: Array<AnalysisRunRow & { work_id: number }>
): Record<number, number | null> {
  const byWork = new Map<number, AnalysisRunRow[]>();
  for (const r of runs) {
    const wid = r.work_id;
    if (!byWork.has(wid)) byWork.set(wid, []);
    byWork.get(wid)!.push(r);
  }
  const out: Record<number, number | null> = {};
  for (const [wid, list] of byWork) {
    out[wid] = agentScoreFromAnalysisRuns(list);
  }
  return out;
}

export type RangeScoreStats = {
  /** 선택된 회차 수 */
  selectedCount: number;
  /** 선택 중 분석 결과가 있는 회차 수 */
  withAnalysisCount: number;
  /** 선택 구간 내 최신 종합 점수만 모은 평균 (없으면 null) */
  averageInRange: number | null;
  min: number | null;
  max: number | null;
};

/**
 * 회차 id 배열은 화면에 보이는 순서(예: 1화부터 오름차순)대로 넘기면 됨.
 * latest는 회차별 최신 1건 Map.
 */
export function scoreStatsForSelection(
  episodeIdsInOrder: number[],
  latest: Map<number, AnalysisRunRow>
): RangeScoreStats {
  const scores: number[] = [];
  for (const id of episodeIdsInOrder) {
    const run = latest.get(id);
    if (run) scores.push(run.result_json.overall_score);
  }
  const selectedCount = episodeIdsInOrder.length;
  const withAnalysisCount = scores.length;
  if (scores.length === 0) {
    return {
      selectedCount,
      withAnalysisCount: 0,
      averageInRange: null,
      min: null,
      max: null,
    };
  }
  const sum = scores.reduce((a, b) => a + b, 0);
  return {
    selectedCount,
    withAnalysisCount,
    averageInRange: Math.round(sum / scores.length),
    min: Math.min(...scores),
    max: Math.max(...scores),
  };
}
