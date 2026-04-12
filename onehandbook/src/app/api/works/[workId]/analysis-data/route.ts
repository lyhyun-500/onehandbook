import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/supabase/appUser";
import type { AnalysisRunRow, HolisticRunRow } from "@/lib/analysisSummary";
import { countManuscriptChars } from "@/lib/nat";

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
    .select("id, episode_number, title, content")
    .eq("work_id", workId)
    .order("episode_number", { ascending: true });

  const episodes = (episodesRaw ?? []).map((e) => ({
    id: e.id,
    episode_number: e.episode_number,
    title: e.title,
    charCount: countManuscriptChars(e.content ?? ""),
  }));

  const { data: analysisRuns } = await supabase
    .from("analysis_runs")
    .select("id, episode_id, agent_version, result_json, created_at, options_json")
    .eq("work_id", workId)
    .order("created_at", { ascending: false });

  const runs = (analysisRuns ?? []) as AnalysisRunRow[];

  const { data: holisticRows, error: holisticErr } = await supabase
    .from("holistic_analysis_runs")
    .select(
      "id, work_id, episode_ids, agent_version, result_json, nat_cost, created_at"
    )
    .eq("work_id", workId)
    .order("created_at", { ascending: false })
    .limit(1);

  const latestHolistic = !holisticErr
    ? ((holisticRows?.[0] ?? null) as HolisticRunRow | null)
    : null;

  return NextResponse.json({
    episodes,
    runs,
    latestHolistic,
  });
}

