import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseAnalysisFeedback,
  type PreviousAnalysisResultPayload,
} from "@/lib/analysisResultCache";
import { buildNatBreakdown, countManuscriptChars, type NatAnalysisOptions } from "@/lib/nat";
import { expireStaleProcessingJobIfNeeded, isStaleJobFailureMessage } from "@/lib/analysis/recoverStaleAnalysisJob";
import { isMissingAnalysisJobsTableError } from "@/lib/db/analysisJobsTable";

export type AnalyzeJobPollBody = {
  status: "pending" | "processing" | "completed" | "failed";
  error?: string;
  code?: string;
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
};

export async function buildAnalyzeJobPollResponse(
  supabase: SupabaseClient,
  jobId: string
): Promise<AnalyzeJobPollBody | null> {
  await expireStaleProcessingJobIfNeeded(supabase, jobId);

  const { data: job, error } = await supabase
    .from("analysis_jobs")
    .select("id, status, error_message, analysis_run_id, episode_id")
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

  if (job.status === "pending" || job.status === "processing") {
    return { status: job.status };
  }

  if (job.status === "failed") {
    const msg = job.error_message ?? "분석에 실패했습니다.";
    return {
      status: "failed",
      error: msg,
      code: isStaleJobFailureMessage(job.error_message) ? "JOB_TIMED_OUT" : undefined,
      retryable: true,
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
      .select("nat_balance")
      .eq("auth_id", user.id)
      .maybeSingle();
    balance = app?.nat_balance ?? undefined;
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
