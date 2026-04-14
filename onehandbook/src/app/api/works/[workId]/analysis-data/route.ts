import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/supabase/appUser";
import type { AnalysisRunRow, HolisticRunRow } from "@/lib/analysisSummary";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workId: string }> }
) {
  const { workId } = await params;
  const supabase = await createClient();
  const appUser = await requireAppUser(supabase);

  const { data: work } = await supabase
    .from("works")
    .select("id, author_id")
    .eq("id", workId)
    .single();

  if (!work || work.author_id !== appUser.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: episodesRaw } = await supabase
    .from("episodes")
    .select("id, episode_number, title")
    .eq("work_id", workId)
    .order("episode_number", { ascending: true });

  const { data: analysisRuns } = await supabase
    .from("analysis_runs")
    .select(
      "id, episode_id, agent_version, result_json, created_at, options_json, char_count"
    )
    .eq("work_id", workId)
    .order("created_at", { ascending: false })
    // 과거 회차가 많아져도 초기 로딩이 무거워지지 않도록 상한을 둔다.
    .limit(2000);

  const runs = (analysisRuns ?? []) as AnalysisRunRow[];

  const latestCharCountByEpisodeId = new Map<number, number>();
  for (const r of runs) {
    const epId = Number(r.episode_id);
    if (!Number.isFinite(epId)) continue;
    if (latestCharCountByEpisodeId.has(epId)) continue;
    const c = (r as unknown as { char_count?: number | null }).char_count;
    if (typeof c === "number" && Number.isFinite(c) && c > 0) {
      latestCharCountByEpisodeId.set(epId, c);
    }
  }

  const episodes = (episodesRaw ?? []).map((e) => ({
    id: e.id,
    episode_number: e.episode_number,
    title: e.title,
    // 대량 content 로딩을 피하기 위해, 최근 분석의 char_count를 우선 사용.
    // 분석 이력이 없으면 패널 오픈 시 별도 endpoint로 계산한다.
    charCount: latestCharCountByEpisodeId.get(Number(e.id)) ?? 0,
  }));

  const { data: holisticRows, error: holisticErr } = await supabase
    .from("holistic_analysis_runs")
    .select(
      "id, work_id, episode_ids, agent_version, result_json, nat_cost, created_at"
    )
    .eq("work_id", workId)
    .order("created_at", { ascending: false })
    .limit(40);

  const holisticHistory = !holisticErr
    ? ((holisticRows ?? []) as HolisticRunRow[])
    : [];

  const latestHolistic =
    holisticHistory.length > 0 ? holisticHistory[0]! : null;

  return NextResponse.json({
    episodes,
    runs,
    latestHolistic,
    holisticHistory,
  });
}

