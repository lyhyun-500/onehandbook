import { NextResponse } from "next/server";
import { createSupabaseServiceRole } from "@/lib/supabase/serviceRole";

function requireAdminSecret(request: Request): string | null {
  const secret = process.env.COIN_ADMIN_SECRET?.trim();
  if (!secret) return null;

  const hdr = request.headers.get("x-coin-admin-secret");
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  return hdr === secret || bearer === secret ? secret : null;
}

export async function POST(request: Request) {
  if (!requireAdminSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { refundId?: unknown; decidedByUserId?: unknown; adminNote?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const refundId = typeof body.refundId === "string" ? body.refundId.trim() : "";
  const decidedByUserIdRaw = body.decidedByUserId;
  const decidedByUserId =
    typeof decidedByUserIdRaw === "number" && Number.isFinite(decidedByUserIdRaw)
      ? Math.floor(decidedByUserIdRaw)
      : typeof decidedByUserIdRaw === "string"
        ? Math.floor(Number(decidedByUserIdRaw))
        : NaN;
  const adminNote = typeof body.adminNote === "string" ? body.adminNote.trim() : null;

  if (!refundId) {
    return NextResponse.json({ error: "refundId가 필요합니다." }, { status: 400 });
  }
  if (!Number.isFinite(decidedByUserId) || decidedByUserId < 1) {
    return NextResponse.json(
      { error: "decidedByUserId가 필요합니다." },
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

  const { data, error } = await admin.rpc("reject_refund_request", {
    p_refund_id: refundId,
    p_decided_by: decidedByUserId,
    p_admin_note: adminNote,
  });

  if (error) {
    console.error("reject_refund_request:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const json = data as { ok?: boolean; error?: string } | null;
  if (!json || json.ok !== true) {
    return NextResponse.json(
      { error: json?.error ?? "환불 거절에 실패했습니다." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, result: json });
}

