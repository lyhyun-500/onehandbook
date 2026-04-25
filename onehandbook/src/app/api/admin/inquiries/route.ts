import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminForApi } from "@/lib/admin/getAdminForApi";
import {
  listAdminInquiries,
  parseInquiriesQueryFromSearchParams,
} from "@/lib/admin/inquiryQueries";
import type { AdminInquiryListResponse } from "@/lib/admin/types";

export async function GET(request: Request) {
  const supabase = await createClient();
  const admin = await getAdminForApi(supabase);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const input = parseInquiriesQueryFromSearchParams(url.searchParams);

  try {
    const result = await listAdminInquiries(supabase, input);
    const body: AdminInquiryListResponse = {
      ok: true,
      inquiries: result.inquiries,
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
    return NextResponse.json(body);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("admin inquiries list:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
