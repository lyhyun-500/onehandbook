import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminForApi } from "@/lib/admin/getAdminForApi";
import { getAdminUserDetail } from "@/lib/admin/queries";
import type { AdminUserDetailResponse } from "@/lib/admin/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const admin = await getAdminForApi(supabase);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "invalid user id" }, { status: 400 });
  }

  try {
    const bundle = await getAdminUserDetail(supabase, id);
    if (!bundle) {
      return NextResponse.json({ error: "user not found" }, { status: 404 });
    }
    const body: AdminUserDetailResponse = {
      ok: true,
      user: bundle.user,
      works: bundle.works,
      recentAnalyses: bundle.recentAnalyses,
      coinLogs: bundle.coinLogs,
    };
    return NextResponse.json(body);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("admin user detail:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
