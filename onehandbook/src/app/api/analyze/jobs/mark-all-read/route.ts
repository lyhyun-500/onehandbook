import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncAppUser } from "@/lib/supabase/appUser";
import { isMissingAnalysisJobsTableError } from "@/lib/db/analysisJobsTable";

export const runtime = "nodejs";

/**
 * 유저의 completed/failed 최상위 job 중 아직 안 읽은 것 (read_at IS NULL) 을
 * 한 번에 읽음 처리하고, 갱신된 job_ids 를 반환한다.
 * 응답 포맷은 클라이언트 호환을 위해 { job_ids: string[] } 유지.
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
    .update({ read_at: new Date().toISOString() })
    .eq("app_user_id", appUser.id)
    .is("parent_job_id", null)
    .in("status", ["completed", "failed"])
    .is("read_at", null)
    .select("id");

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
