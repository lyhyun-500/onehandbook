import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncAppUser } from "@/lib/supabase/appUser";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  const raw = body.episodeIds;
  if (!Array.isArray(raw) || raw.length === 0) {
    return NextResponse.json({ error: "episodeIds 배열이 필요합니다." }, { status: 400 });
  }

  const episodeIds = raw
    .map((x) => (typeof x === "number" ? x : parseInt(String(x), 10)))
    .filter((n) => !Number.isNaN(n));
  if (episodeIds.length === 0) {
    return NextResponse.json({ error: "유효한 episodeId가 없습니다." }, { status: 400 });
  }

  const appUser = await syncAppUser(supabase);
  if (!appUser) {
    return NextResponse.json({ error: "사용자 정보를 찾을 수 없습니다." }, { status: 403 });
  }

  const { data: eps, error } = await supabase
    .from("episodes")
    .select("id, episode_number, work_id")
    .in("id", episodeIds);

  if (error || !eps) {
    return NextResponse.json({ error: "회차 정보를 불러오지 못했습니다." }, { status: 500 });
  }

  const workIds = [...new Set(eps.map((e) => e.work_id).filter((x) => x != null))];
  if (workIds.length > 0) {
    const { data: works } = await supabase
      .from("works")
      .select("id, author_id")
      .in("id", workIds);
    const ok = (works ?? []).every((w) => w.author_id === appUser.id);
    if (!ok) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }
  }

  const map: Record<string, number> = {};
  for (const e of eps) {
    if (typeof e.id === "number" && typeof e.episode_number === "number") {
      map[String(e.id)] = e.episode_number;
    }
  }

  return NextResponse.json({ episode_numbers_by_id: map });
}

