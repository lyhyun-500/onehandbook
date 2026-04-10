import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * `is_training_curator = true` 인 계정(사령관)만: 해당 로그에 is_good 표시.
 * DB RPC `mark_training_log_good` 호출.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
  }

  const { error } = await supabase.rpc("mark_training_log_good", { p_id: id });

  if (error) {
    const msg = error.message;
    if (msg.includes("training curator only")) {
      return NextResponse.json(
        { error: "품질 표시 권한이 없습니다. (큐레이터 계정만 가능)" },
        { status: 403 }
      );
    }
    if (msg.includes("training_log not found")) {
      return NextResponse.json({ error: "기록을 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
