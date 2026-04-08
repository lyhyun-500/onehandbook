import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * work_context_hash 컬럼이 아직 없거나 PostgREST 스키마 캐시에 없을 때
 * 쿼리/삽입이 실패하는 것을 감지해 레거시 경로로 폴백합니다.
 */
export function isMissingWorkContextHashColumnError(
  err: { message?: string; code?: string } | null | undefined
): boolean {
  if (!err) return false;
  const msg = (err.message ?? "").toLowerCase();
  const code = String(err.code ?? "");
  if (code === "PGRST204" && msg.includes("work_context_hash")) return true;
  if (
    msg.includes("work_context_hash") &&
    (msg.includes("schema cache") ||
      msg.includes("does not exist") ||
      msg.includes("unknown"))
  ) {
    return true;
  }
  return false;
}

export type AnalysisResultSnapshotRow = {
  work_id: number;
  episode_id: number;
  analysis_run_id: number;
  score: number;
  feedback: string;
  nat_consumed: number;
  content_hash: string;
  analyzed_at: string;
  work_context_hash: string;
};

export async function insertAnalysisResultSnapshot(
  supabase: SupabaseClient,
  row: AnalysisResultSnapshotRow
): Promise<{ error: { message: string } | null }> {
  const { error: e1 } = await supabase.from("analysis_results").insert(row);
  if (!e1) return { error: null };
  if (!isMissingWorkContextHashColumnError(e1)) {
    return { error: { message: e1.message ?? "insert failed" } };
  }
  const { work_context_hash: _ignored, ...legacy } = row;
  void _ignored;
  const { error: e2 } = await supabase.from("analysis_results").insert(legacy);
  if (!e2) return { error: null };
  return { error: { message: e2.message ?? "insert failed" } };
}

/** CONTENT_UNCHANGED 판정용 최신 analysis_results 한 건 */
export type LatestAnalysisResultForContentGuard = {
  score: number;
  feedback: string | null;
  nat_consumed: number;
  created_at: string;
  content_hash: string | null;
  work_context_hash?: string | null;
};

export async function fetchLatestAnalysisResultForContentGuard(
  supabase: SupabaseClient,
  episodeId: number
): Promise<{
  row: LatestAnalysisResultForContentGuard | null;
  fetchError: boolean;
}> {
  const full = await supabase
    .from("analysis_results")
    .select(
      "score, feedback, nat_consumed, created_at, content_hash, work_context_hash"
    )
    .eq("episode_id", episodeId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!full.error && full.data) {
    return { row: full.data as LatestAnalysisResultForContentGuard, fetchError: false };
  }
  if (full.error && isMissingWorkContextHashColumnError(full.error)) {
    const leg = await supabase
      .from("analysis_results")
      .select("score, feedback, nat_consumed, created_at, content_hash")
      .eq("episode_id", episodeId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (leg.error) {
      console.warn(
        "analysis_results 이전 조회 실패(레거시 컬럼):",
        leg.error.message
      );
      return { row: null, fetchError: true };
    }
    return {
      row: (leg.data as LatestAnalysisResultForContentGuard | null) ?? null,
      fetchError: false,
    };
  }
  if (full.error) {
    console.warn("analysis_results 이전 조회 실패:", full.error.message);
  }
  return { row: null, fetchError: !!full.error };
}
