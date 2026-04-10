import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseAnalysisFeedback,
  type PreviousAnalysisResultPayload,
} from "@/lib/analysisResultCache";
import { buildNatBreakdown, countManuscriptChars, type NatAnalysisOptions } from "@/lib/nat";
import { expireStaleProcessingJobIfNeeded, isStaleJobFailureMessage } from "@/lib/analysis/recoverStaleAnalysisJob";
import { isMissingAnalysisJobsTableError } from "@/lib/db/analysisJobsTable";
import { ANALYSIS_JOB_FAILURE_CONTENT_UNCHANGED } from "@/lib/analysis/analysisJobFailureCodes";
import { isContentUnchangedFailure } from "@/lib/analysis/analysisJobFailureHeuristics";
import type { AnalysisJobPayload } from "@/lib/analysis/executeAnalysisJob";
import type { HolisticAnalysisJobPayload } from "@/lib/analysis/executeHolisticAnalysisJob";
import {
  isHolisticAnalysisJobPeek,
  orderedEpisodeIdsFromJobPayload,
} from "@/lib/analysis/holisticJobPayload";
import { parseDbInt } from "@/lib/supabase/parseDbInt";

export type UnchangedForceRetryPayload =
  | {
      mode: "episode";
      episodeId: number;
      agentVersion: string;
      includeLore: boolean;
      includePlatformOptimization: boolean;
      /** 원고 미변경을 이미 확인했으면 true */
      force?: boolean;
    }
  | {
      mode: "holistic_batch";
      workId: number;
      episodeIds: number[];
      agentVersion: string;
      includeLore: boolean;
      includePlatformOptimization: boolean;
      force?: boolean;
    };

export type AnalyzeJobPollBody = {
  status: "pending" | "processing" | "completed" | "failed";
  error?: string;
  code?: string;
  job_kind?: "episode" | "holistic_batch";
  work_id?: number;
  episode_id?: number;
  /** 원고 미변경 실패 시, 동일 옵션으로 강제 재요청에 필요한 값 */
  unchangedForceRetry?: UnchangedForceRetryPayload;
  /** 실패 시 재시도(새 분석 요청) 가능 여부 */
  retryable?: boolean;
  analysis?: {
    id: number;
    episode_id: number;
    work_id: number;
    agent_version: string;
    result_json: unknown;
    created_at: string;
  };
  previousResult?: PreviousAnalysisResultPayload | null;
  nat?: { spent: number; balance: number | undefined };
  breakdown?: ReturnType<typeof buildNatBreakdown>;
  cached?: boolean;
  /** 통합 분석 완료 시 */
  holistic_run_id?: number | null;
};

export async function buildAnalyzeJobPollResponse(
  supabase: SupabaseClient,
  jobId: string
): Promise<AnalyzeJobPollBody | null> {
  await expireStaleProcessingJobIfNeeded(supabase, jobId);

  const { data: job, error } = await supabase
    .from("analysis_jobs")
    .select(
      "id, status, error_message, analysis_run_id, holistic_run_id, episode_id, app_user_id, payload, job_kind, work_id"
    )
    .eq("id", jobId)
    .single();

  if (error) {
    if (isMissingAnalysisJobsTableError(error)) {
      return {
        status: "failed",
        error:
          "analysis_jobs 테이블이 없습니다. Supabase에서 마이그레이션을 적용해 주세요.",
        code: "MIGRATION_REQUIRED",
        retryable: false,
      };
    }
    return null;
  }

  if (!job) {
    return null;
  }

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (authUser) {
    const { data: row } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", authUser.id)
      .maybeSingle();
    if (!row || row.id !== job.app_user_id) {
      return null;
    }
  }

  const pollMeta = {
    job_kind:
      job.job_kind === "holistic_batch"
        ? ("holistic_batch" as const)
        : ("episode" as const),
    work_id:
      typeof job.work_id === "number"
        ? job.work_id
        : parseInt(String(job.work_id ?? ""), 10),
    episode_id:
      typeof job.episode_id === "number"
        ? job.episode_id
        : parseInt(String(job.episode_id ?? ""), 10),
  };

  if (job.status === "pending" || job.status === "processing") {
    return { status: job.status, ...pollMeta };
  }

  if (job.status === "failed") {
    const msg = job.error_message ?? "분석에 실패했습니다.";
    const payload = job.payload as { failure_code?: string } | null;
    const failureCode = payload?.failure_code;
    const stale = isStaleJobFailureMessage(job.error_message);
    const unchanged = isContentUnchangedFailure({
      failure_code: failureCode ?? null,
      error_message: job.error_message,
    });
    const code = unchanged
      ? ANALYSIS_JOB_FAILURE_CONTENT_UNCHANGED
      : stale
        ? "JOB_TIMED_OUT"
        : undefined;

    let unchangedForceRetry: UnchangedForceRetryPayload | undefined;
    if (unchanged) {
      const rawPayload = job.payload as Record<string, unknown> | null;
      const wid = pollMeta.work_id;
      const eid = pollMeta.episode_id;
      if (pollMeta.job_kind === "episode") {
        const p = rawPayload as Partial<AnalysisJobPayload> | null;
        if (
          typeof p?.requestedVersion === "string" &&
          Number.isFinite(wid) &&
          Number.isFinite(eid)
        ) {
          unchangedForceRetry = {
            mode: "episode",
            episodeId: eid as number,
            agentVersion: p.requestedVersion,
            includeLore: p.includeLore !== false,
            includePlatformOptimization: p.includePlatformOptimization !== false,
            force: true,
          };
        }
      } else {
        const p = rawPayload as Partial<HolisticAnalysisJobPayload> | null;
        const wRaw = p?.workId;
        const hw =
          typeof wRaw === "number" && Number.isFinite(wRaw)
            ? wRaw
            : typeof wRaw === "string"
              ? parseInt(wRaw, 10)
              : NaN;
        const hwOk = !Number.isNaN(hw) && hw > 0;
        const ids = orderedEpisodeIdsFromJobPayload(rawPayload) ?? [];
        if (typeof p?.requestedVersion === "string" && hwOk && ids.length > 0) {
          unchangedForceRetry = {
            mode: "holistic_batch",
            workId: hw,
            episodeIds: ids,
            agentVersion: p.requestedVersion,
            includeLore: p.includeLore !== false,
            includePlatformOptimization: p.includePlatformOptimization !== false,
            force: true,
          };
        }
      }
    }

    return {
      status: "failed",
      error: msg,
      code,
      retryable: code !== ANALYSIS_JOB_FAILURE_CONTENT_UNCHANGED,
      unchangedForceRetry,
      ...pollMeta,
    };
  }

  const holisticPeek = isHolisticAnalysisJobPeek(job.job_kind, job.payload);
  const holisticRunId = parseDbInt(job.holistic_run_id);

  if (holisticPeek) {
    if (holisticRunId != null) {
      return {
        status: "completed",
        ...pollMeta,
        holistic_run_id: holisticRunId,
        retryable: false,
      };
    }
    return {
      status: "failed",
      error:
        "통합 분석 결과가 서버에 연결되지 않았습니다. 같은 증상이 반복되면 작업을 다시 시도해 주세요.",
      code: "HOLISTIC_JOB_INCOMPLETE",
      retryable: true,
      ...pollMeta,
    };
  }

  if (job.status !== "completed" || !job.analysis_run_id) {
    return {
      status: "failed",
      error: "결과를 불러올 수 없습니다.",
      retryable: true,
    };
  }

  const { data: run } = await supabase
    .from("analysis_runs")
    .select(
      "id, episode_id, work_id, agent_version, result_json, created_at, nat_cost, options_json"
    )
    .eq("id", job.analysis_run_id)
    .single();

  if (!run) {
    return {
      status: "failed",
      error: "분석 결과 행을 찾을 수 없습니다.",
      retryable: true,
    };
  }

  const { data: episode } = await supabase
    .from("episodes")
    .select("content")
    .eq("id", job.episode_id)
    .single();

  const charCount = episode?.content
    ? countManuscriptChars(episode.content)
    : 0;

  const optJson = run.options_json as Record<string, unknown> | null;
  const opts: NatAnalysisOptions = {
    includeLore: optJson?.includeLore !== false,
    includePlatformOptimization: optJson?.includePlatformOptimization !== false,
  };

  const breakdown = buildNatBreakdown(charCount, opts);

  const { data: lastTwo } = await supabase
    .from("analysis_results")
    .select("score, feedback, nat_consumed, created_at")
    .eq("episode_id", job.episode_id)
    .order("created_at", { ascending: false })
    .limit(2);

  let previousResult: PreviousAnalysisResultPayload | null = null;
  if (lastTwo && lastTwo.length >= 2) {
    previousResult = {
      score: lastTwo[1].score,
      feedback: parseAnalysisFeedback(lastTwo[1].feedback ?? ""),
      nat_consumed: lastTwo[1].nat_consumed,
      created_at: lastTwo[1].created_at,
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  let balance: number | undefined;
  if (user) {
    const { data: app } = await supabase
      .from("users")
      .select("coin_balance")
      .eq("auth_id", user.id)
      .maybeSingle();
    balance = app?.coin_balance ?? undefined;
  }

  return {
    status: "completed",
    analysis: {
      id: run.id,
      episode_id: run.episode_id,
      work_id: run.work_id,
      agent_version: run.agent_version,
      result_json: run.result_json,
      created_at: run.created_at,
    },
    previousResult,
    nat: { spent: run.nat_cost ?? 0, balance },
    breakdown,
    cached: false,
  };
}
