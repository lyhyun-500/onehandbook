import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingWorkContextHashColumnError } from "@/lib/analysis/analysisResultsWorkContextSupport";

export type CachedAnalysisRunRow = {
  id: number;
  episode_id: number;
  work_id: number;
  agent_version: string;
  result_json: unknown;
  created_at: string;
  options_json?: Record<string, unknown> | null;
};

/**
 * 동일 episode + content_hash + work_context_hash + agent_version(프로필 id)인 가장 최신 분석이 있으면 반환.
 * NAT/API 없이 재사용 가능.
 */
export async function findCachedAnalysisRun(
  supabase: SupabaseClient,
  episodeId: number,
  contentHash: string,
  workContextHash: string,
  agentVersion: string
): Promise<CachedAnalysisRunRow | null> {
  let { data: ar, error } = await supabase
    .from("analysis_results")
    .select("analysis_run_id")
    .eq("episode_id", episodeId)
    .eq("content_hash", contentHash)
    .eq("work_context_hash", workContextHash)
    .order("created_at", { ascending: false });

  if (error && isMissingWorkContextHashColumnError(error)) {
    const second = await supabase
      .from("analysis_results")
      .select("analysis_run_id")
      .eq("episode_id", episodeId)
      .eq("content_hash", contentHash)
      .order("created_at", { ascending: false });
    ar = second.data;
    error = second.error;
  }

  if (error || !ar?.length) return null;

  const runIds = [...new Set(ar.map((r) => r.analysis_run_id))];
  const { data: runs } = await supabase
    .from("analysis_runs")
    .select(
      "id, episode_id, work_id, agent_version, result_json, created_at, options_json"
    )
    .in("id", runIds)
    .eq("agent_version", agentVersion);

  const runById = new Map(runs?.map((r) => [r.id, r]) ?? []);
  for (const row of ar) {
    const run = runById.get(row.analysis_run_id);
    if (run) return run as CachedAnalysisRunRow;
  }
  return null;
}
