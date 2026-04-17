import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/supabase/appUser";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ workId: string }> }
) {
  const { workId } = await params;
  const supabase = await createClient();
  const appUser = await requireAppUser(supabase);

  const { data: work, error: workErr } = await supabase
    .from("works")
    .select("id, author_id, deleted_at")
    .eq("id", workId)
    .maybeSingle();

  if (workErr || !work || work.author_id !== appUser.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (work.deleted_at) {
    return NextResponse.json({ ok: true });
  }

  const { error: delErr } = await supabase
    .from("works")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", workId)
    .eq("author_id", appUser.id);

  if (delErr) {
    return NextResponse.json(
      { error: delErr.message ?? "삭제에 실패했습니다." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

