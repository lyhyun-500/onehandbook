import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncAppUser } from "@/lib/supabase/appUser";
import { isMissingAnalysisJobsTableError } from "@/lib/db/analysisJobsTable";

export type AnalysisJobListItem = {
  id: string;
  episode_id: number;
  work_id: number;
  status: "pending" | "processing" | "completed" | "failed";
  updated_at: string;
};

/**
 * 로그인 사용자의 최근 분석 작업 목록 (회차별 뱃지·폴링용).
 * 회차당 최신 작업은 클라이언트에서 `updated_at` 기준으로 줄입니다.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const appUser = await syncAppUser(supabase);
  if (!appUser) {
    return NextResponse.json({ error: "사용자 정보를 찾을 수 없습니다." }, { status: 403 });
  }

  const { data: jobs, error } = await supabase
    .from("analysis_jobs")
    .select("id, episode_id, status, updated_at")
    .eq("app_user_id", appUser.id)
    .order("updated_at", { ascending: false })
    .limit(300);

  if (error) {
    if (isMissingAnalysisJobsTableError(error)) {
      return NextResponse.json({ jobs: [] as AnalysisJobListItem[] });
    }
    console.error("analysis_jobs list:", error.message);
    return NextResponse.json(
      { error: "작업 목록을 불러오지 못했습니다." },
      { status: 500 }
    );
  }

  const rows = jobs ?? [];
  const episodeIds = [...new Set(rows.map((r) => r.episode_id))];
  if (episodeIds.length === 0) {
    return NextResponse.json({ jobs: [] as AnalysisJobListItem[] });
  }

  const { data: episodes, error: epErr } = await supabase
    .from("episodes")
    .select("id, work_id")
    .in("id", episodeIds);

  if (epErr) {
    console.error("episodes for jobs:", epErr.message);
    return NextResponse.json(
      { error: "회차 정보를 불러오지 못했습니다." },
      { status: 500 }
    );
  }

  const workByEpisode = new Map<number, number>();
  for (const e of episodes ?? []) {
    workByEpisode.set(e.id, e.work_id);
  }

  const list: AnalysisJobListItem[] = [];
  for (const r of rows) {
    const workId = workByEpisode.get(r.episode_id);
    if (workId == null) continue;
    const st = r.status;
    if (
      st !== "pending" &&
      st !== "processing" &&
      st !== "completed" &&
      st !== "failed"
    ) {
      continue;
    }
    list.push({
      id: r.id,
      episode_id: r.episode_id,
      work_id: workId,
      status: st,
      updated_at: r.updated_at,
    });
  }

  return NextResponse.json({ jobs: list });
}
