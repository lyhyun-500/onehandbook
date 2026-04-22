import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminForApi } from "@/lib/admin/getAdminForApi";
import {
  listAdminUsers,
  parseUsersQueryFromSearchParams,
} from "@/lib/admin/queries";
import type { AdminUserListResponse } from "@/lib/admin/types";

export async function GET(request: Request) {
  const supabase = await createClient();
  const admin = await getAdminForApi(supabase);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const input = parseUsersQueryFromSearchParams(url.searchParams);

  try {
    const result = await listAdminUsers(supabase, input);
    const body: AdminUserListResponse = {
      ok: true,
      users: result.users,
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
    return NextResponse.json(body);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("admin users list:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
