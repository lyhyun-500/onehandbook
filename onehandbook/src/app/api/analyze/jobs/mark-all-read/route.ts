import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseServiceRole } from "@/lib/supabase/serviceRole";
import { syncAppUser } from "@/lib/supabase/appUser";
import { isMissingAnalysisJobsTableError } from "@/lib/db/analysisJobsTable";

export const runtime = "nodejs";

/**
 * "모두 읽음": 분석 알림 (analysis_jobs.read_at) + 통합 알림 (notifications.read_at)
 * 양쪽을 동시에 처리. ADR-0008 옵션 X (점진 마이그레이션) 동안 헤더 벨 배지 일관성 유지용.
 *
 * 응답 포맷은 기존 클라이언트 호환을 위해 { job_ids: string[] } 유지.
 * notifications 처리 결과는 클라이언트가 별도 refresh 로 흡수 (옵션 a).
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

  const nowIso = new Date().toISOString();

  const { data: rows, error } = await supabase
    .from("analysis_jobs")
    .update({ read_at: nowIso })
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

  // notifications 도 함께 일괄 마크. 마이그레이션 미적용/권한 이슈가 있어도
  // 분석 쪽 응답은 이미 정상이므로 콘솔 로그만 남기고 진행.
  // (RLS 정책상 UPDATE 는 service_role 만 가능 → service_role 클라이언트 사용.)
  try {
    const service = createSupabaseServiceRole();
    const { error: nErr } = await service
      .from("notifications")
      .update({ read_at: nowIso })
      .eq("user_id", appUser.id)
      .is("read_at", null);
    if (nErr && nErr.code !== "42P01") {
      console.warn("mark-all-read notifications:", nErr.message);
    }
  } catch (e) {
    console.warn("mark-all-read notifications:", e);
  }

  const ids = (rows ?? [])
    .map((r) => String(r.id ?? "").trim())
    .filter(Boolean);

  return NextResponse.json({ job_ids: ids });
}
