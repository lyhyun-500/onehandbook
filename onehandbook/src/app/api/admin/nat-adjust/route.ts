import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseServiceRole } from "@/lib/supabase/serviceRole";
import { getAdminForApi } from "@/lib/admin/getAdminForApi";
import type {
  NatAdjustFailure,
  NatAdjustSuccess,
} from "@/lib/admin/types";

// POST /api/admin/nat-adjust
// 흐름:
//   1) 쿠키 기반 세션에서 어드민 권한 재검증 (getAdminForApi)
//   2) 통과하면 service_role 클라이언트로 RPC 호출
//      - charge → credit_nat (reason='admin_adjust', metadata 에 adjusted_by/admin_reason)
//      - deduct → admin_debit_nat (admin_reason 파라미터, service_role 전용)
//   3) RPC 의 jsonb 결과를 파싱해 UI 용 에러/성공 응답으로 매핑

type Body = Partial<{
  userId: number;
  type: "charge" | "deduct";
  amount: number;
  reason: string;
}>;

function fail(
  error: string,
  status: number,
  extra?: Partial<NatAdjustFailure>
) {
  const body: NatAdjustFailure = { ok: false, error, ...extra };
  return NextResponse.json(body, { status });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const admin = await getAdminForApi(supabase);
  if (!admin) return fail("Unauthorized", 401);

  let parsed: Body;
  try {
    parsed = (await request.json()) as Body;
  } catch {
    return fail("invalid_json", 400);
  }

  const userId = Number(parsed.userId);
  if (!Number.isFinite(userId) || userId <= 0 || !Number.isInteger(userId)) {
    return fail("invalid_user_id", 400);
  }

  const type =
    parsed.type === "charge" || parsed.type === "deduct" ? parsed.type : null;
  if (!type) return fail("invalid_type", 400);

  const amount = Number(parsed.amount);
  if (!Number.isInteger(amount) || amount < 1 || amount > 100000) {
    return fail("invalid_amount", 400);
  }

  const reason =
    typeof parsed.reason === "string" ? parsed.reason.trim() : "";
  if (!reason) return fail("reason_required", 400);
  if (reason.length > 500) return fail("reason_too_long", 400);

  let service;
  try {
    service = createSupabaseServiceRole();
  } catch {
    return fail("service_role_unavailable", 500);
  }

  if (type === "charge") {
    const { data, error } = await service.rpc("credit_nat", {
      p_user_id: userId,
      p_amount: amount,
      p_reason: "admin_adjust",
      p_metadata: {
        adjusted_by: admin.authId,
        admin_reason: reason,
      },
    });
    if (error) {
      console.error("nat-adjust credit_nat:", error.message);
      return fail(error.message, 500);
    }
    const result = (data as {
      ok: boolean;
      balance?: number;
      error?: string;
    }) ?? {
      ok: false,
      error: "empty_response",
    };
    if (!result.ok) {
      return fail(result.error ?? "charge_failed", 400);
    }
    const success: NatAdjustSuccess = {
      ok: true,
      newBalance: result.balance ?? 0,
    };
    return NextResponse.json(success);
  }

  // deduct
  const { data, error } = await service.rpc("admin_debit_nat", {
    p_user_id: userId,
    p_amount: amount,
    p_admin_reason: reason,
    p_admin_auth_id: admin.authId,
    p_metadata: {},
  });
  if (error) {
    console.error("nat-adjust admin_debit_nat:", error.message);
    return fail(error.message, 500);
  }
  const result = (data as {
    ok: boolean;
    balance?: number;
    required?: number;
    error?: string;
  }) ?? { ok: false, error: "empty_response" };
  if (!result.ok) {
    return fail(result.error ?? "debit_failed", 400, {
      balance: result.balance,
      required: result.required,
    });
  }
  const success: NatAdjustSuccess = {
    ok: true,
    newBalance: result.balance ?? 0,
  };
  return NextResponse.json(success);
}
