import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildAnalyzeJobPollResponse } from "@/lib/analysis/buildAnalyzeJobPollResponse";
import { kickStalePendingAnalysisJobIfNeeded } from "@/lib/analysis/kickStalePendingAnalysisJob";

export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { jobId } = await context.params;
  if (!jobId) {
    return NextResponse.json({ error: "jobId가 필요합니다." }, { status: 400 });
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (accessToken) {
    await kickStalePendingAnalysisJobIfNeeded(supabase, jobId, accessToken);
  }

  const body = await buildAnalyzeJobPollResponse(supabase, jobId);
  if (!body) {
    return NextResponse.json({ error: "작업을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json(body);
}
