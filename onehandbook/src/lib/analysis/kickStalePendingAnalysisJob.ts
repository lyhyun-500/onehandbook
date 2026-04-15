import type { SupabaseClient } from "@supabase/supabase-js";
import { runAnalysisProcessAfterResponse } from "@/lib/analysis/scheduleAnalysisProcess";

/** after() 미실행·토큰 실패 등으로 pending에 멈출 때 — 폴링으로 복구하기 전 짧은 유예 */
const PENDING_STALE_GRACE_MS = 12_000;
/** 폴링·목록 조회가 과도하게 process를 두드리지 않도록 */
const KICK_THROTTLE_MS = 40_000;
/** pending이 이 시간을 넘기면 사실상 유령 job로 간주하고 failed로 정리 */
const PENDING_HARD_EXPIRE_MS = 12 * 60 * 1000;

const PENDING_EXPIRE_MESSAGE =
  "분석 트리거가 지연되어 작업이 만료되었습니다. 다시 시도해 주세요.";

/**
 * pending 상태가 유예 시간을 넘겼으면 `runAnalysisProcessAfterResponse`를 한 번 더 시도.
 * 서버리스에서 초기 트리거가 누락된 작업을 폴링·목록 API가 복구한다.
 */
export async function kickStalePendingAnalysisJobIfNeeded(
  supabase: SupabaseClient,
  jobId: string,
  accessToken: string
): Promise<void> {
  const { data: row } = await supabase
    .from("analysis_jobs")
    .select("id, status, created_at, payload")
    .eq("id", jobId)
    .maybeSingle();

  if (!row || row.status !== "pending") return;

  const createdRaw =
    typeof row.created_at === "string" ? row.created_at : null;
  if (!createdRaw) return;
  const created = new Date(createdRaw).getTime();
  if (Number.isNaN(created) || Date.now() - created < PENDING_STALE_GRACE_MS) {
    return;
  }
  const ageMs = Date.now() - created;
  if (ageMs > PENDING_HARD_EXPIRE_MS) {
    await supabase
      .from("analysis_jobs")
      .update({
        status: "failed",
        error_message: PENDING_EXPIRE_MESSAGE,
        progress_phase: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId)
      .eq("status", "pending");
    return;
  }

  const payload = (row.payload as Record<string, unknown> | null) ?? {};
  const last = payload.lastProcessKick;
  if (typeof last === "string") {
    const lastMs = new Date(last).getTime();
    if (!Number.isNaN(lastMs) && Date.now() - lastMs < KICK_THROTTLE_MS) {
      return;
    }
  }

  const { error } = await supabase
    .from("analysis_jobs")
    .update({
      payload: { ...payload, lastProcessKick: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("status", "pending");

  if (error) return;

  void runAnalysisProcessAfterResponse(jobId, accessToken);
}

export function isPendingExpireMessage(message: string | null | undefined): boolean {
  return message === PENDING_EXPIRE_MESSAGE;
}
