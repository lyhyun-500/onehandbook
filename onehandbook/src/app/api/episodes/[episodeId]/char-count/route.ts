import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/supabase/appUser";
import { countManuscriptChars } from "@/lib/nat";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ episodeId: string }> }
) {
  const { episodeId } = await params;
  const episodeIdNum = Number.parseInt(episodeId, 10);
  if (!Number.isFinite(episodeIdNum)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const supabase = await createClient();
  const appUser = await requireAppUser(supabase);

  const { data: episode } = await supabase
    .from("episodes")
    .select("id, work_id, content")
    .eq("id", episodeIdNum)
    .single();

  if (!episode) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: work } = await supabase
    .from("works")
    .select("id, author_id")
    .eq("id", episode.work_id)
    .single();

  if (!work || work.author_id !== appUser.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const charCount = countManuscriptChars(episode.content ?? "");
  return NextResponse.json({ episodeId: episode.id, charCount });
}

