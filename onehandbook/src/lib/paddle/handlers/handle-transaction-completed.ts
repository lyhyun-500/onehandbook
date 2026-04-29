/**
 * ADR-0010 Phase 3a Step 3-4-A
 * Paddle `transaction.completed` 처리: NAT 자동 충전 + 거래 로그 저장.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceRole } from "@/lib/supabase/serviceRole";
import type {
  PaddleTransaction,
  PaddleWebhookEnvelope,
} from "@/lib/paddle/event-types";

const PADDLE_ENVIRONMENT = "sandbox" as const;

type PriceMapping = {
  product_type: "subscription" | "one_time";
  nat_amount: number;
};

type CreditNatResult = {
  ok?: boolean;
  balance?: number;
  error?: string;
} | null;

/**
 * transaction.completed 이벤트 처리 진입점.
 * - throw 없이 항상 { success, reason } 반환
 * - 멱등성: paddle_transactions.status='completed' 이면 즉시 성공 처리
 */
export async function handleTransactionCompleted(
  event: PaddleWebhookEnvelope<"transaction.completed", PaddleTransaction>
): Promise<{ success: boolean; reason?: string }> {
  const txn = event.data;
  const txnId = txn.id;
  const customerId = txn.customer_id;
  const priceId = txn.items[0]?.price_id;

  if (!customerId) {
    console.error("[handleTransactionCompleted] customer_id 없음:", txnId);
    return { success: false, reason: "no_customer_id" };
  }
  if (!priceId) {
    console.error("[handleTransactionCompleted] price_id 없음:", txnId);
    return { success: false, reason: "no_price_id" };
  }

  const supabase = createSupabaseServiceRole();

  // 1) 멱등성 체크
  const { data: existingTx, error: checkError } = await supabase
    .from("paddle_transactions")
    .select("id, status, nat_credited")
    .eq("id", txnId)
    .maybeSingle();

  if (checkError) {
    console.error("[handleTransactionCompleted] 거래 사전 조회 실패:", checkError.message);
    return { success: false, reason: "db_check_failed" };
  }

  if (existingTx?.status === "completed") {
    console.log("[handleTransactionCompleted] 이미 처리됨:", txnId);
    return { success: true, reason: "already_processed" };
  }

  // 2) price_id -> NAT 매핑 조회
  const { data: mapping, error: mappingError } = await supabase
    .from("paddle_price_nat_mapping")
    .select("product_type, nat_amount")
    .eq("paddle_price_id", priceId)
    .eq("active", true)
    .maybeSingle<PriceMapping>();

  if (mappingError) {
    console.error("[handleTransactionCompleted] 매핑 조회 실패:", mappingError.message);
    return { success: false, reason: "mapping_lookup_failed" };
  }

  if (!mapping) {
    console.error("[handleTransactionCompleted] 매핑 없음:", { txnId, priceId });
    await saveUnmappedTransaction(supabase, txn, "unknown_price_id");
    await notifyAdmin("unknown_price_id", { txnId, priceId });
    return { success: false, reason: "unmapped_price" };
  }

  // 3) customer_id -> users.id 매핑
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id")
    .eq("paddle_customer_id", customerId)
    .is("deleted_at", null)
    .maybeSingle<{ id: number }>();

  if (userError) {
    console.error("[handleTransactionCompleted] 유저 조회 실패:", userError.message);
    return { success: false, reason: "user_lookup_failed" };
  }

  if (!user) {
    console.error("[handleTransactionCompleted] 유저 없음:", { txnId, customerId });
    await saveUnmappedTransaction(supabase, txn, "unknown_customer_id");
    await notifyAdmin("unknown_customer_id", { txnId, customerId });
    return { success: false, reason: "unmapped_customer" };
  }

  // 4) NAT 충전 RPC 호출
  const paymentMethod = txn.payments?.[0]?.method_details?.type ?? null;
  const { data: creditResult, error: creditError } = await supabase.rpc("credit_nat", {
    p_user_id: user.id,
    p_amount: mapping.nat_amount,
    p_reason: "purchase_credit",
    p_ref_type: "paddle_transaction",
    p_ref_id: null,
    p_metadata: {
      paddle_transaction_id: txnId,
      paddle_subscription_id: txn.subscription_id ?? null,
      paddle_price_id: priceId,
      product_type: mapping.product_type,
      payment_method: paymentMethod,
      environment: PADDLE_ENVIRONMENT,
    },
  });

  if (creditError) {
    console.error("[handleTransactionCompleted] credit_nat RPC 실패:", creditError.message);
    await saveFailedTransaction(supabase, txn, mapping, user.id, "credit_nat_error");
    return { success: false, reason: "credit_nat_error" };
  }

  const credit = (creditResult as CreditNatResult) ?? null;
  if (!credit?.ok) {
    console.error("[handleTransactionCompleted] credit_nat 거절:", credit);
    await saveFailedTransaction(
      supabase,
      txn,
      mapping,
      user.id,
      credit?.error ?? "unknown"
    );
    return { success: false, reason: `credit_nat_rejected_${credit?.error ?? "unknown"}` };
  }

  const newBalance = typeof credit.balance === "number" ? credit.balance : null;
  console.log("[handleTransactionCompleted] NAT 충전 성공:", {
    txnId,
    userId: user.id,
    amount: mapping.nat_amount,
    newBalance,
  });

  // 5) 거래 로그 저장
  const totalAmount = toIntSafe(txn.details?.totals?.total);
  const currency = txn.details?.totals?.currency_code ?? "KRW";

  const { error: insertError } = await supabase.from("paddle_transactions").upsert(
    {
      id: txnId,
      user_id: user.id,
      paddle_customer_id: customerId,
      paddle_subscription_id: txn.subscription_id,
      paddle_price_id: priceId,
      amount: totalAmount,
      currency,
      status: "completed",
      payment_method: paymentMethod,
      nat_credited: mapping.nat_amount,
      paddle_payload: txn,
      environment: PADDLE_ENVIRONMENT,
    },
    { onConflict: "id" }
  );

  if (insertError) {
    // NAT는 이미 충전된 상태. 저장 실패만 알리고 성공으로 간주.
    console.error(
      "[handleTransactionCompleted] paddle_transactions 저장 실패 (NAT는 충전됨):",
      insertError.message
    );
    await notifyAdmin("transaction_save_failed_after_credit", {
      txnId,
      userId: user.id,
    });
    return { success: true, reason: "credit_ok_but_save_failed" };
  }

  // 6) 사용자 알림 (실패해도 충전 완료 흐름은 유지)
  const { error: notifError } = await supabase.from("notifications").insert({
    user_id: user.id,
    type: "payment_completed",
    ref_id: txnId,
    title: "NAT 충전 완료",
    body: `${mapping.nat_amount} NAT가 충전되었습니다.`,
    link_url: "/billing",
  });

  if (notifError) {
    console.error("[handleTransactionCompleted] 사용자 알림 저장 실패:", notifError.message);
  }

  return { success: true };
}

async function saveUnmappedTransaction(
  supabase: SupabaseClient,
  txn: PaddleTransaction,
  reason: string
): Promise<void> {
  const totalAmount = toIntSafe(txn.details?.totals?.total);
  const currency = txn.details?.totals?.currency_code ?? "KRW";

  const { error } = await supabase.from("paddle_transactions").upsert(
    {
      id: txn.id,
      user_id: null,
      paddle_customer_id: txn.customer_id,
      paddle_subscription_id: txn.subscription_id,
      paddle_price_id: txn.items[0]?.price_id ?? null,
      amount: totalAmount,
      currency,
      status: "unmapped",
      payment_method: txn.payments?.[0]?.method_details?.type ?? null,
      nat_credited: null,
      paddle_payload: {
        txn,
        unmapped_reason: reason,
      },
      environment: PADDLE_ENVIRONMENT,
    },
    { onConflict: "id" }
  );

  if (error) {
    console.error("[handleTransactionCompleted] unmapped 거래 저장 실패:", error.message);
  }
}

async function saveFailedTransaction(
  supabase: SupabaseClient,
  txn: PaddleTransaction,
  mapping: PriceMapping,
  userId: number,
  errorReason: string
): Promise<void> {
  const totalAmount = toIntSafe(txn.details?.totals?.total);
  const currency = txn.details?.totals?.currency_code ?? "KRW";

  const { error } = await supabase.from("paddle_transactions").upsert(
    {
      id: txn.id,
      user_id: userId,
      paddle_customer_id: txn.customer_id,
      paddle_subscription_id: txn.subscription_id,
      paddle_price_id: txn.items[0]?.price_id ?? null,
      amount: totalAmount,
      currency,
      status: "failed",
      payment_method: txn.payments?.[0]?.method_details?.type ?? null,
      nat_credited: null,
      paddle_payload: {
        txn,
        product_type: mapping.product_type,
        nat_amount: mapping.nat_amount,
        error_reason: errorReason,
      },
      environment: PADDLE_ENVIRONMENT,
    },
    { onConflict: "id" }
  );

  if (error) {
    console.error("[handleTransactionCompleted] failed 거래 저장 실패:", error.message);
  }
}

async function notifyAdmin(
  alertType: string,
  payload: Record<string, unknown>
): Promise<void> {
  // TODO: Step 3-4-B에서 실제 관리자 알림 채널(슬랙/어드민 notifications 등) 연결
  console.error("[ADMIN ALERT][paddle]", alertType, payload);
}

function toIntSafe(v: string | undefined): number {
  if (!v) return 0;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
}

