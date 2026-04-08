import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncAppUser } from "@/lib/supabase/appUser";
import { isMissingAnalysisJobsTableError } from "@/lib/db/analysisJobsTable";

export const runtime = "nodejs";

/**
 * "모두 읽음"은 현재 클라이언트(sessionStorage) 기반이라 DB에 read 플래그를 저장하지 않습니다.
 * 대신 서버가 "해당 유저의 결과(outcome) job id 목록"을 반환하고,
 * 클라이언트가 이를 readOutcomeJobIds에 반영해 UI를 일괄 읽음 처리합니다.
 */
export async function POST() {
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

  const { data: rows, error } = await supabase
    .from("analysis_jobs")
    .select("id, status")
    .eq("app_user_id", appUser.id)
    .in("status", ["completed", "failed"])
    .order("updated_at", { ascending: false })
    .limit(2000);

  if (error) {
    if (isMissingAnalysisJobsTableError(error)) {
      return NextResponse.json({ job_ids: [] as string[] });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ids = (rows ?? [])
    .map((r) => String(r.id ?? "").trim())
    .filter(Boolean);

  return NextResponse.json({ job_ids: ids });
}

