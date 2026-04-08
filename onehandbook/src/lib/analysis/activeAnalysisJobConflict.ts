import type { SupabaseClient } from "@supabase/supabase-js";

function coversTargetEpisodes(
  row: {
    job_kind: string | null;
    episode_id: number | null;
    payload: unknown;
  },
  target: Set<number>
): number[] {
  const out: number[] = [];
  if (row.job_kind === "holistic_batch") {
    const ord = (row.payload as { orderedEpisodeIds?: unknown } | null)
      ?.orderedEpisodeIds;
    if (Array.isArray(ord)) {
      for (const x of ord) {
        const id = typeof x === "number" ? x : parseInt(String(x), 10);
        if (!Number.isNaN(id) && target.has(id)) out.push(id);
      }
    }
    return out;
  }
  const ep =
    typeof row.episode_id === "number"
      ? row.episode_id
      : row.episode_id != null
        ? parseInt(String(row.episode_id), 10)
        : NaN;
  if (!Number.isNaN(ep) && target.has(ep)) out.push(ep);
  return out;
}

/** 진행 중(pending|processing) 작업이 포함하는 회차 중 `targetEpisodeIds`와 겹치는 id */
export async function conflictingEpisodeIdsForActiveJobs(
  supabase: SupabaseClient,
  appUserId: number,
  targetEpisodeIds: number[]
): Promise<number[]> {
  if (targetEpisodeIds.length === 0) return [];
  const target = new Set(targetEpisodeIds);
  const { data: rows, error } = await supabase
    .from("analysis_jobs")
    .select("job_kind, episode_id, payload")
    .eq("app_user_id", appUserId)
    .in("status", ["pending", "processing"]);
  if (error || !rows?.length) return [];
  const hit = new Set<number>();
  for (const r of rows) {
    for (const id of coversTargetEpisodes(
      {
        job_kind: (r.job_kind as string | null) ?? null,
        episode_id: r.episode_id as number | null,
        payload: r.payload,
      },
      target
    )) {
      hit.add(id);
    }
  }
  return [...hit];
}
