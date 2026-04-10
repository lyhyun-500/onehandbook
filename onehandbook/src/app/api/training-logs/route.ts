import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncAppUser } from "@/lib/supabase/appUser";
import { insertTrainingLogPair } from "@/lib/training/trainingLogs";

export const runtime = "nodejs";

/**
 * 질문·AI 답변이 생성된 뒤 호출해 학습 로그 한 건을 저장합니다.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const appUser = await syncAppUser(supabase);
  if (!appUser) {
    return NextResponse.json(
      { error: "사용자 정보를 찾을 수 없습니다." },
      { status: 403 }
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 JSON입니다." }, { status: 400 });
  }

  const b = raw as Record<string, unknown>;
  const userMessage = typeof b.userMessage === "string" ? b.userMessage : "";
  const assistantMessage =
    typeof b.assistantMessage === "string" ? b.assistantMessage : "";
  const context =
    b.context != null &&
    typeof b.context === "object" &&
    !Array.isArray(b.context)
      ? (b.context as Record<string, unknown>)
      : {};

  try {
    const { id } = await insertTrainingLogPair(supabase, appUser.id, {
      userMessage,
      assistantMessage,
      context,
    });
    return NextResponse.json({ id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "저장에 실패했습니다.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
