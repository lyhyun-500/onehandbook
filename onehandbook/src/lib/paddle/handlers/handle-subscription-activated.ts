/**
 * ADR-0010 Phase 3a Step 3-4-B
 * Paddle `subscription.activated` 처리: 구독 엔티티 저장 + 사용자 알림(구독 시작).
 *
 * 주의:
 * - NAT 지급은 하지 않음 (transaction.completed가 담당)
 * - customer.created가 아직 처리되지 않았을 수 있으므로 user_id는 NULL 허용
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceRole } from "@/lib/supabase/serviceRole";
import type {
  PaddleSubscription,
  PaddleWebhookEnvelope,
} from "@/lib/paddle/event-types";

const PADDLE_ENVIRONMENT = "sandbox" as const;

export async function handleSubscriptionActivated(
  event: PaddleWebhookEnvelope<"subscription.activated", PaddleSubscription>
): Promise<{ success: boolean; reason?: string }> {
  const sub = event.data;
  const subId = sub.id;
  const customerId = sub.customer_id;
  const priceId = sub.items[0]?.price.id;

  if (!customerId) {
    console.error("[handleSubscriptionActivated] customer_id 없음:", subId);
    return { success: false, reason: "no_customer_id" };
  }
  if (!priceId) {
    console.error("[handleSubscriptionActivated] price_id 없음:", subId);
    return { success: false, reason: "no_price_id" };
  }

  const supabase = createSupabaseServiceRole();

  // 1) 멱등성 체크 (이미 active면 성공 처리)
  const { data: existing, error: existingError } = await supabase
    .from("paddle_subscriptions")
    .select("id, status")
    .eq("id", subId)
    .maybeSingle<{ id: string; status: string }>();

  if (existingError) {
    console.error("[handleSubscriptionActivated] 구독 사전 조회 실패:", existingError.message);
    return { success: false, reason: "db_check_failed" };
  }

  if (existing?.status === "active") {
    return { success: true, reason: "already_active" };
  }

  // 2) user_id 매핑 (없어도 저장은 진행)
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id")
    .eq("paddle_customer_id", customerId)
    .is("deleted_at", null)
    .maybeSingle<{ id: number }>();

  if (userError) {
    console.error("[handleSubscriptionActivated] 유저 조회 실패:", userError.message);
    return { success: false, reason: "user_lookup_failed" };
  }

  if (!user) {
    console.error("[handleSubscriptionActivated] customer 매핑 유저 없음:", {
      subId,
      customerId,
    });
    await notifyAdmin("subscription_activated_unknown_customer", {
      subId,
      customerId,
    });
  }

  // 3) paddle_subscriptions UPSERT
  const { error: upsertError } = await supabase.from("paddle_subscriptions").upsert(
    {
      id: subId,
      user_id: user?.id ?? null,
      paddle_customer_id: customerId,
      paddle_price_id: priceId,
      status: "active",
      activated_at: event.occurred_at,
      current_period_starts_at: sub.current_billing_period?.starts_at ?? null,
      current_period_ends_at: sub.current_billing_period?.ends_at ?? null,
      next_billed_at: sub.next_billed_at ?? null,
      paddle_payload: sub,
      environment: PADDLE_ENVIRONMENT,
    },
    { onConflict: "id" }
  );

  if (upsertError) {
    console.error("[handleSubscriptionActivated] paddle_subscriptions 저장 실패:", upsertError.message);
    return { success: false, reason: "subscription_upsert_failed" };
  }

  // 4) 사용자 알림 (user가 있을 때만)
  if (user) {
    const { error: notifError } = await supabase.from("notifications").insert({
      user_id: user.id,
      type: "subscription_activated",
      ref_id: subId,
      title: "구독이 시작되었어요",
      body: "Novel Agent 구독이 활성화됐어요.",
      link_url: "/billing",
    });
    if (notifError) {
      console.error("[handleSubscriptionActivated] 사용자 알림 저장 실패:", notifError.message);
    }
  }

  return { success: true };
}

async function notifyAdmin(
  alertType: string,
  payload: Record<string, unknown>
): Promise<void> {
  // TODO: 실제 관리자 알림 채널 연결 (슬랙/어드민 notifications 등)
  console.error("[ADMIN ALERT][paddle]", alertType, payload);
}

