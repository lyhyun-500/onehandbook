import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnalysisResult, HolisticAnalysisResult } from "@/lib/ai/types";
import { md5Hex } from "@/lib/contentHash";
import { serializeAnalysisFeedback } from "@/lib/analysisResultCache";
import { insertAnalysisResultSnapshot } from "@/lib/analysis/analysisResultsWorkContextSupport";
import { buildHolisticDisplay } from "@/lib/holisticWeightedScore";
import { countManuscriptChars } from "@/lib/nat";
import {
  holisticEpisodeScoreCoverage,
  logHolisticPipeline,
  type HolisticPipelineDbLogInput,
} from "@/lib/analysis/holisticPipelineLog";

/** analysis_results.score CHECK(0–100) 및 정수 컬럼에 맞춤 */
function clampAnalysisSnapshotScore(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 0;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

export type HolisticSyncEpisodeRow = {
  id: number;
  episode_number: number;
  content: string | null;
};

/** NAT 차감 실패 등으로 통합 동기화만 되돌릴 때 사용 */
export async function deleteHolisticSyncedAnalysisRunIds(
  supabase: SupabaseClient,
  ids: number[]
): Promise<void> {
  for (const id of [...ids].reverse()) {
    await supabase.from("analysis_runs").delete().eq("id", id);
  }
}

/**
 * 통합(일괄) 분석이 끝난 뒤, 회차 목록의 "이 화 분석" 최신 점수·캐시가 맞도록
 * `analysis_runs` / `analysis_results` / `episodes.content_hash` 를 반영합니다.
 * 회차별 행은 nat_cost 0입니다. 일부만 성공하면 안 되므로 실패 시 이미 넣은 `analysis_runs`는 롤백하고 에러를 던집니다.
 * (호출부에서 `holistic_analysis_runs` 삭제·NAT 미차감 처리 권장)
 * @returns 삽입한 `analysis_runs.id` 목록 (NAT 차감 실패 시 롤백용)
 */
export async function syncPerEpisodeAnalysisFromHolisticRun(
  supabase: SupabaseClient,
  args: {
    workId: number;
    holisticRunId: number;
    agentVersion: string;
    holisticResult: HolisticAnalysisResult;
    episodes: HolisticSyncEpisodeRow[];
    optionsJson: Record<string, unknown>;
    workContextHash: string;
    pipelineDbLog?: HolisticPipelineDbLogInput;
  }
): Promise<number[]> {
  const {
    workId,
    holisticRunId,
    agentVersion,
    holisticResult,
    episodes,
    optionsJson,
    workContextHash,
    pipelineDbLog,
  } = args;

  const dbCtx = pipelineDbLog
    ? {
        ...pipelineDbLog,
        workId,
        holisticRunId,
        analysisJobId: pipelineDbLog.analysisJobId ?? null,
      }
    : undefined;

  const expectedEpisodeNumbers = episodes.map((e) => e.episode_number);
  logHolisticPipeline(
    "sync_per_episode_input",
    {
      workId,
      holisticRunId,
      episodeDbIds: episodes.map((e) => e.id),
      ...holisticEpisodeScoreCoverage(expectedEpisodeNumbers, holisticResult),
    },
    dbCtx
  );

  const scoreByEpisodeNumber = new Map<number, number>();
  for (const es of holisticResult.episode_scores ?? []) {
    if (
      typeof es.episode_number === "number" &&
      !Number.isNaN(es.episode_number) &&
      typeof es.score === "number" &&
      !Number.isNaN(es.score)
    ) {
      scoreByEpisodeNumber.set(
        es.episode_number,
        clampAnalysisSnapshotScore(es.score)
      );
    }
  }

  const orderedForWeight = episodes.map((e) => ({
    episode_number: e.episode_number,
    title: "",
    charCount: countManuscriptChars(e.content ?? ""),
  }));
  const { weightedOverall } = buildHolisticDisplay(
    holisticResult,
    orderedForWeight
  );
  const rawOverallFallback =
    typeof holisticResult.overall_score === "number" &&
    !Number.isNaN(holisticResult.overall_score)
      ? holisticResult.overall_score
      : weightedOverall;
  const overallFallback = clampAnalysisSnapshotScore(rawOverallFallback);

  if (scoreByEpisodeNumber.size === 0) {
    console.warn(
      "syncPerEpisodeAnalysisFromHolisticRun: episode_scores 비어 있음, overall로 보간",
      { holisticRunId, workId, overallFallback }
    );
  }

  const analyzedAt = new Date().toISOString();
  const dims = holisticResult.dimensions ?? {};
  const improvements = holisticResult.improvements ?? [];
  const execNote = holisticResult.executive_summary?.slice(0, 2000);

  const insertedRunIds: number[] = [];
  const fallbackEpisodeNumbers: number[] = [];

  try {
    for (const ep of episodes) {
      let score = scoreByEpisodeNumber.get(ep.episode_number);
      if (typeof score !== "number") {
        score = overallFallback;
        fallbackEpisodeNumbers.push(ep.episode_number);
        console.warn(
          `syncPerEpisodeAnalysisFromHolisticRun: ${ep.episode_number}화 episode_scores 누락 → overall(${score}) 보간 (id ${ep.id})`,
          { holisticRunId, workId }
        );
      } else {
        score = clampAnalysisSnapshotScore(score);
      }

      const resultJson: AnalysisResult = {
        overall_score: score,
        dimensions: dims,
        improvement_points: [...improvements],
        comparable_note: execNote,
        trends_references: holisticResult.trends_references,
      };

      const contentHash = md5Hex(ep.content ?? "");
      const optionsRecord = {
        ...optionsJson,
        from_holistic_run_id: holisticRunId,
        holistic_derived: true,
      };

      const { data: runRow, error: insErr } = await supabase
        .from("analysis_runs")
        .insert({
          episode_id: ep.id,
          work_id: workId,
          agent_version: agentVersion,
          result_json: resultJson,
          nat_cost: 0,
          options_json: optionsRecord,
        })
        .select("id")
        .single();

      if (insErr || !runRow) {
        console.error("analysis_runs (holistic 동기화) 저장 실패:", {
          workId,
          holisticRunId,
          episode_id: ep.id,
          episode_number: ep.episode_number,
          code: insErr?.code,
          message: insErr?.message,
          details: (insErr as { details?: string } | undefined)?.details,
          hint: (insErr as { hint?: string } | undefined)?.hint,
        });
        throw new Error(
          insErr?.message ??
            `통합 분석 결과를 ${ep.episode_number}화에 저장하지 못했습니다.`
        );
      }

      insertedRunIds.push(runRow.id);

      const { error: cacheErr } = await insertAnalysisResultSnapshot(supabase, {
        work_id: workId,
        episode_id: ep.id,
        analysis_run_id: runRow.id,
        score,
        feedback: serializeAnalysisFeedback(resultJson),
        nat_consumed: 0,
        content_hash: contentHash,
        work_context_hash: workContextHash,
        analyzed_at: analyzedAt,
      });

      if (cacheErr) {
        console.error("analysis_results (holistic 동기화) 저장 실패:", {
          workId,
          holisticRunId,
          episode_id: ep.id,
          episode_number: ep.episode_number,
          message: cacheErr.message,
        });
        throw new Error(
          cacheErr.message ??
            `통합 분석 캐시를 ${ep.episode_number}화에 저장하지 못했습니다.`
        );
      }

      const { error: hashErr } = await supabase
        .from("episodes")
        .update({ content_hash: contentHash })
        .eq("id", ep.id);
      if (hashErr) {
        console.warn("episodes content_hash (holistic 동기화) 실패:", hashErr.message);
      }
    }

    logHolisticPipeline(
      "sync_per_episode_done",
      {
        workId,
        holisticRunId,
        analysisRunsInserted: insertedRunIds.length,
        fallbackEpisodeNumbers,
        usedOverallBecauseEmptyEpisodeScores: scoreByEpisodeNumber.size === 0,
      },
      dbCtx
    );

    return insertedRunIds;
  } catch (e) {
    await deleteHolisticSyncedAnalysisRunIds(supabase, insertedRunIds);
    throw e;
  }
}
