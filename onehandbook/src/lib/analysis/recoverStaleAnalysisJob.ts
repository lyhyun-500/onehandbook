import type { SupabaseClient } from "@supabase/supabase-js";

/** 이 화 분석: processing 상태가 이 시간을 넘기면 실패 처리 (updated_at 기준). 서버 타임아웃 등으로 멈춘 작업을 너무 오래 두지 않도록 5분으로 둔다. */
export const ANALYSIS_JOB_PROCESSING_STALE_MS = 5 * 60 * 1000;

/**
 * 통합 분석: LLM 구간에서 `updated_at`이 안 바뀌는 시간이 길어 10분 만료에 걸리면
 * 워커는 돌고 있는데 폴링이 잡을 failed로 바꿔 완료 갱신이 막히는 문제가 생김.
 */
export const ANALYSIS_JOB_HOLISTIC_PROCESSING_STALE_MS = 55 * 60 * 1000;

const STALE_ERROR_MESSAGE =
  "분석 처리 시간이 초과되었습니다. 다시 시도해 주세요.";

/**
 * 해당 job이 processing이고 updated_at이 오래됐으면 failed로 전환.
 * 폴링·조회 전에 호출.
 */
export async function expireStaleProcessingJobIfNeeded(
  supabase: SupabaseClient,
  jobId: string
): Promise<void> {
  const { data: row } = await supabase
    .from("analysis_jobs")
    .select("job_kind")
    .eq("id", jobId)
    .eq("status", "processing")
    .maybeSingle();

  if (!row) return;

  const staleMs =
    row.job_kind === "holistic_batch"
      ? ANALYSIS_JOB_HOLISTIC_PROCESSING_STALE_MS
      : ANALYSIS_JOB_PROCESSING_STALE_MS;

  const cutoff = new Date(Date.now() - staleMs).toISOString();

  await supabase
    .from("analysis_jobs")
    .update({
      status: "failed",
      error_message: STALE_ERROR_MESSAGE,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("status", "processing")
    .lt("updated_at", cutoff);
}

export function isStaleJobFailureMessage(message: string | null | undefined): boolean {
  return message === STALE_ERROR_MESSAGE;
}
