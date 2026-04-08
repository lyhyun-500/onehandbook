import type { SupabaseClient } from "@supabase/supabase-js";
import type { HolisticAnalysisResult } from "@/lib/ai/types";
import { isMissingHolisticPipelineEventsTableError } from "@/lib/db/holisticPipelineEventsTable";

/** 호스트 로그에서 `holistic-pipeline`으로 grep 하면 통합 분석 진단만 모을 수 있습니다. */
export const HOLISTIC_PIPELINE_GREP = "holistic-pipeline";

/** 서버·클라이언트 요청에서 넘길 때: work_id는 호출부에서 채움 */
export type HolisticPipelineDbLogInput = {
  supabase: SupabaseClient;
  appUserId: number;
  analysisJobId?: string | null;
};

export type HolisticPipelineDbContext = HolisticPipelineDbLogInput & {
  workId: number;
  holisticRunId?: number | null;
};

export type HolisticEpisodeScoreCoverage = {
  expectedEpisodeNumbers: number[];
  expectedCount: number;
  modelEpisodeScoresCount: number;
  modelReportedNumbers: number[];
  missingVersusExpected: number[];
  unexpectedVersusExpected: number[];
  hasEpisodeNumberZero: boolean;
  duplicateReportedNumbers: number[];
  /** UI 차트(buildHolisticDisplay)에 실제로 찍히는 회차 수 */
  chartWouldShowEpisodeCount: number;
};

/**
 * 모델 JSON의 episode_scores가 선택 회차와 어떻게 어긋났는지 요약합니다.
 * (문자열 회차번호 등으로 파싱되면 0으로 들어가 hasEpisodeNumberZero로 드러남)
 */
export function holisticEpisodeScoreCoverage(
  expectedEpisodeNumbers: readonly number[],
  result: HolisticAnalysisResult
): HolisticEpisodeScoreCoverage {
  const expected = [...new Set(expectedEpisodeNumbers)].sort((a, b) => a - b);
  const scores = result.episode_scores ?? [];
  const reported = scores.map((s) => s.episode_number);
  const expectedSet = new Set(expected);
  const reportedSet = new Set(reported);
  const missingVersusExpected = expected.filter((n) => !reportedSet.has(n));
  const unexpectedVersusExpected = reported.filter((n) => !expectedSet.has(n));
  const seen = new Set<number>();
  const dupHit = new Set<number>();
  for (const n of reported) {
    if (seen.has(n)) dupHit.add(n);
    seen.add(n);
  }
  const chartWouldShowEpisodeCount = expected.filter((n) =>
    reportedSet.has(n)
  ).length;

  return {
    expectedEpisodeNumbers: expected,
    expectedCount: expected.length,
    modelEpisodeScoresCount: scores.length,
    modelReportedNumbers: reported,
    missingVersusExpected,
    unexpectedVersusExpected,
    hasEpisodeNumberZero: reported.some((n) => n === 0),
    duplicateReportedNumbers: [...dupHit],
    chartWouldShowEpisodeCount,
  };
}

export function logHolisticPipeline(
  step: string,
  payload: Record<string, unknown>,
  db?: HolisticPipelineDbContext | null
): void {
  console.info(`[${HOLISTIC_PIPELINE_GREP}]`, step, JSON.stringify(payload));
  if (!db?.supabase) return;
  void db.supabase
    .from("holistic_pipeline_events")
    .insert({
      app_user_id: db.appUserId,
      work_id: db.workId,
      analysis_job_id: db.analysisJobId ?? null,
      holistic_run_id: db.holisticRunId ?? null,
      step,
      payload,
    })
    .then(({ error }) => {
      if (!error) return;
      if (isMissingHolisticPipelineEventsTableError(error)) return;
      console.warn(
        `[${HOLISTIC_PIPELINE_GREP}] db insert failed`,
        step,
        error.message
      );
    });
}
