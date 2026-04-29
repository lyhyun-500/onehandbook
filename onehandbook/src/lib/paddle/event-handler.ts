/**
 * ADR-0010 Phase 3a Step 3-3-B — Paddle Webhook 분기 및 Hybrid 처리(동기 즉시 / 큐)
 *
 * - 동기(sync): 추가 NAT 구매(one_time), 첫 구독(activated), customer 매핑, 보안 알림 등
 * - 큐(queue): 구독 갱신 거래(subscription 매핑 또는 미매핑), 라이프사이클, 결제 실패, 조정 등
 *
 * 실제 비즈니스 로직(NAT 충전, 알림 저장)은 Step 3-4에서 연결 예정 (`dispatchEventHandler` placeholder).
 */

import { createSupabaseServiceRole } from "@/lib/supabase/serviceRole";
import { handleTransactionCompleted } from "@/lib/paddle/handlers/handle-transaction-completed";
import type { PaddleWebhookEvent } from "./event-types";

export type ProcessingMode = "sync" | "queue";

export interface ProcessingDecision {
  mode: ProcessingMode;
  reason: string;
}

/**
 * 이벤트의 즉시 처리 여부 판단.
 * `transaction.completed` 만 `paddle_price_nat_mapping.product_type` 조회가 필요하다 (DB).
 */
export async function shouldProcessImmediately(
  event: PaddleWebhookEvent
): Promise<ProcessingDecision> {
  switch (event.event_type) {
    case "transaction.completed": {
      const tx = event.data;
      const priceId = tx.items[0]?.price_id;
      if (!priceId) {
        return { mode: "queue", reason: "no_price_id_fallback_to_queue" };
      }

      try {
        const supabase = createSupabaseServiceRole();
        const { data: mapping, error } = await supabase
          .from("paddle_price_nat_mapping")
          .select("product_type")
          .eq("paddle_price_id", priceId)
          .eq("active", true)
          .maybeSingle();

        if (error) {
          console.error("[paddle event-handler] price 매핑 조회 실패:", error.message);
          return { mode: "queue", reason: "mapping_lookup_error_to_queue" };
        }

        if (mapping?.product_type === "one_time") {
          return { mode: "sync", reason: "nat_purchase_immediate" };
        }

        return {
          mode: "queue",
          reason: mapping ? "subscription_renewal" : "unknown_price_to_queue",
        };
      } catch (e) {
        console.error("[paddle event-handler] shouldProcessImmediately 예외:", e);
        return { mode: "queue", reason: "mapping_lookup_exception_to_queue" };
      }
    }

    case "subscription.activated":
      return { mode: "sync", reason: "first_subscription" };

    case "customer.created":
      return { mode: "sync", reason: "customer_mapping_required" };

    case "api_key.expiring":
    case "api_key.expired":
    case "api_key.revoked":
    case "api_key_exposure.created":
    case "client_token.revoked":
      return { mode: "sync", reason: "security_event_immediate" };

    case "transaction.payment_failed":
    case "subscription.canceled":
    case "subscription.past_due":
    case "subscription.updated":
    case "adjustment.created":
      return { mode: "queue", reason: "low_priority_async" };

    default: {
      const _exhaustive: never = event;
      console.error("[paddle event-handler] 알 수 없는 event_type:", _exhaustive);
      return { mode: "queue", reason: "unexpected_event_fallback" };
    }
  }
}

/**
 * Paddle webhook 이벤트 라우팅의 메인 진입점.
 */
export async function processPaddleWebhookEvent(
  event: PaddleWebhookEvent
): Promise<{ success: boolean; mode: ProcessingMode; reason?: string }> {
  const decision = await shouldProcessImmediately(event);

  console.log("[paddle event-handler] 분기 결정:", {
    event_type: event.event_type,
    notification_id: event.notification_id,
    mode: decision.mode,
    reason: decision.reason,
  });

  if (decision.mode === "sync") {
    return processSync(event, decision);
  }

  return processQueue(event, decision);
}

async function processSync(
  event: PaddleWebhookEvent,
  decision: ProcessingDecision
): Promise<{ success: boolean; mode: ProcessingMode; reason?: string }> {
  try {
    await dispatchEventHandler(event);

    try {
      await markWebhookProcessed(event.notification_id);
    } catch (markErr) {
      console.error("[paddle event-handler] 동기 처리 후 마킹 실패:", markErr);
      console.log("[paddle event-handler] 큐 fallback 으로 전환");
      return processQueue(event, {
        mode: "queue",
        reason: "sync_mark_failure_fallback",
      });
    }

    return { success: true, mode: "sync", reason: decision.reason };
  } catch (err) {
    console.error("[paddle event-handler] 동기 처리 실패:", err);
    console.log("[paddle event-handler] 큐 fallback 으로 전환");
    return processQueue(event, {
      mode: "queue",
      reason: "sync_failure_fallback",
    });
  }
}

async function processQueue(
  event: PaddleWebhookEvent,
  decision: ProcessingDecision
): Promise<{ success: boolean; mode: ProcessingMode; reason?: string }> {
  console.log("[paddle event-handler] 큐 대기:", {
    notification_id: event.notification_id,
    decision_reason: decision.reason,
  });

  /** row 는 수신 라우트에서 이미 적재되어 있으며, 여기선 Cron 이 `processed_at` 을 채운다고 가정. */
  return { success: true, mode: "queue", reason: decision.reason };
}

/**
 * Step 3-4에서 타입별 핸들러로 교체 예정 (NAT 충전, users 매핑, 어드민 알림 등).
 */
async function dispatchEventHandler(event: PaddleWebhookEvent): Promise<void> {
  switch (event.event_type) {
    case "transaction.completed": {
      const result = await handleTransactionCompleted(event);
      if (!result.success) {
        throw new Error(result.reason ?? "transaction_completed_failed");
      }
      break;
    }

    case "subscription.activated":
      console.log("[paddle event-handler] TODO Step 3-4: subscription.activated handler");
      break;

    case "customer.created":
      console.log("[paddle event-handler] TODO Step 3-4: customer.created handler");
      break;

    case "api_key.expiring":
    case "api_key.expired":
    case "api_key.revoked":
    case "api_key_exposure.created":
    case "client_token.revoked":
      console.log("[paddle event-handler] TODO Step 3-4: security event handler");
      break;

    default:
      /** 큐 전용 이벤트는 동기 dispatch 대상이 아님 (라우트 분기에서 이미 제외). */
      break;
  }
}

async function markWebhookProcessed(notificationId: string): Promise<void> {
  const supabase = createSupabaseServiceRole();
  const { error } = await supabase
    .from("paddle_webhooks")
    .update({
      processed_at: new Date().toISOString(),
      error: null,
    })
    .eq("id", notificationId);

  if (error) {
    console.error("[paddle event-handler] processed_at 업데이트 실패:", error.message);
    throw error;
  }
}
