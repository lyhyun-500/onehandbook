import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  let body: { terms?: boolean; privacy?: boolean; marketing?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  if (body.terms !== true || body.privacy !== true) {
    return NextResponse.json(
      { error: "필수 항목에 동의해 주세요." },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("users")
    .update({
      terms_agreed_at: now,
      privacy_agreed_at: now,
      marketing_agreed: body.marketing === true,
    })
    .eq("auth_id", user.id);

  if (error) {
    console.error("users consent:", error.message);
    return NextResponse.json(
      { error: "저장에 실패했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
