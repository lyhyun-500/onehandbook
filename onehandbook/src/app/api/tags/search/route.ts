import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const limitRaw = parseInt(url.searchParams.get("limit") ?? "12", 10);
  const limit = Math.min(20, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 12));

  if (!q) {
    return NextResponse.json({ tags: [] as string[] });
  }

  const { data, error } = await supabase
    .from("tags")
    .select("name, usage_count")
    .ilike("name", `%${q}%`)
    .order("usage_count", { ascending: false })
    .order("name", { ascending: true })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    tags: (data ?? []).map((r) => r.name).filter((s): s is string => typeof s === "string"),
  });
}

