import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/supabase/appUser";

export async function POST(request: Request) {
  let body: { amount?: unknown; reason?: unknown; metadata?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const amountRaw = body.amount;
  const amount =
    typeof amountRaw === "number" && Number.isFinite(amountRaw)
      ? Math.floor(amountRaw)
      : typeof amountRaw === "string"
        ? Math.floor(Number(amountRaw))
        : NaN;

  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const metadata =
    body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
      ? (body.metadata as Record<string, unknown>)
      : {};

  if (!Number.isFinite(amount) || amount < 1 || amount > 100000) {
    return NextResponse.json(
      { error: "환불 요청 amount가 올바르지 않습니다." },
      { status: 400 }
    );
  }
  if (!reason || reason.length < 2 || reason.length > 500) {
    return NextResponse.json(
      { error: "환불 사유를 2~500자 사이로 입력해 주세요." },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const appUser = await requireAppUser(supabase);

  const { data, error } = await supabase
    .from("refund_requests")
    .insert({
      user_id: appUser.id,
      amount,
      reason,
      status: "PENDING",
      metadata,
    })
    .select("id, status, amount, reason, requested_at")
    .single();

  if (error) {
    console.error("refund request insert:", error.message);
    return NextResponse.json(
      { error: "환불 요청 생성에 실패했습니다." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, refund: data });
}

