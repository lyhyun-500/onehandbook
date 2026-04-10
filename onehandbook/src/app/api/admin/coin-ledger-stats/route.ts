import { NextResponse } from "next/server";
import { createSupabaseServiceRole } from "@/lib/supabase/serviceRole";

/**
 * coin_logs 일·월별 적립/소모/소멸 합계 (관리용).
 * 헤더 `x-coin-admin-secret` 또는 `Authorization: Bearer <COIN_ADMIN_SECRET>` 필요.
 */
export async function GET(request: Request) {
  const secret = process.env.COIN_ADMIN_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "COIN_ADMIN_SECRET 미설정" },
      { status: 503 }
    );
  }

  const hdr = request.headers.get("x-coin-admin-secret");
  const auth = request.headers.get("authorization");
  const bearer =
    auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  if (hdr !== secret && bearer !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const grain = searchParams.get("grain") === "monthly" ? "monthly" : "daily";
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json(
      { error: "쿼리 from, to (YYYY-MM-DD)가 필요합니다." },
      { status: 400 }
    );
  }

  let admin;
  try {
    admin = createSupabaseServiceRole();
  } catch {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY 필요" },
      { status: 500 }
    );
  }

  const fn =
    grain === "monthly" ? "coin_logs_monthly_totals" : "coin_logs_daily_totals";

  const { data, error } = await admin.rpc(fn, {
    p_from: from,
    p_to: to,
  });

  if (error) {
    console.error("coin ledger stats:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, grain, from, to, rows: data ?? [] });
}
