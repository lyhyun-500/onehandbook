/**
 * ADR-0010 Phase 3a Step 3-3-A — Paddle Billing Webhook 이벤트 타입 정의
 *
 * 참고 문서:
 * - Webhook 개요: https://developer.paddle.com/webhooks/overview
 * - Notification settings: https://developer.paddle.com/api-reference/notification-settings/overview
 *
 * // ADR-0010 의 미구독 이벤트 (transaction.created / billed / paid 등) 는 의도적으로 제외.
 * // 추가 필요 시 이 파일과 `event-handler.ts` 분기 로직을 **동시에** 업데이트할 것.
 */

/** ADR-0010 에서 Paddle destination 에 구독한 12개 이벤트 (Tier 1~4). */
export type PaddleEventType =
  // Tier 1: 결제 핵심
  | "transaction.completed"
  | "transaction.payment_failed"
  | "subscription.activated"
  | "subscription.canceled"
  | "subscription.past_due"
  | "subscription.updated"
  // Tier 2: 환불/조정
  | "adjustment.created"
  // Tier 3: 고객
  | "customer.created"
  // Tier 4: 보안
  | "api_key.expiring"
  | "api_key.expired"
  | "api_key.revoked"
  | "api_key_exposure.created"
  | "client_token.revoked";

/**
 * 모든 Paddle Billing webhook 공통 외피.
 * 실제 원문에는 추가 필드가 있을 수 있으나 Phase 3a에서는 아래 필드 중심으로 처리한다.
 */
export interface PaddleWebhookEnvelope<TEventType extends PaddleEventType, TData> {
  event_id: string;
  event_type: TEventType;
  occurred_at: string;
  notification_id: string;
  data: TData;
}

/** 거래(Transaction) 객체 — 금액·라인아이템·결제수단 정보 추출용. */
export interface PaddleTransaction {
  id: string;
  status:
    | "draft"
    | "ready"
    | "billed"
    | "paid"
    | "completed"
    | "canceled"
    | "past_due";
  customer_id: string | null;
  subscription_id: string | null;
  items: Array<{
    price_id: string;
    quantity: number;
    totals?: {
      subtotal: string;
      total: string;
      currency_code: string;
    };
  }>;
  details?: {
    totals: {
      subtotal: string;
      total: string;
      currency_code: string;
    };
  };
  payments?: Array<{
    payment_method_id?: string;
    method_details?: {
      type?: string;
    };
  }>;
  custom_data?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/** 구독(Subscription) 객체 — 구독 상태·예정 청구일 추적용. */
export interface PaddleSubscription {
  id: string;
  status: "active" | "canceled" | "past_due" | "paused" | "trialing";
  customer_id: string;
  items: Array<{
    price: {
      id: string;
      product_id: string;
    };
    quantity: number;
  }>;
  current_billing_period?: {
    starts_at: string;
    ends_at: string;
  };
  next_billed_at?: string;
  custom_data?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/** Adjustment — 환불/크레딧/차지백 등 정산 조정 레코드. */
export interface PaddleAdjustment {
  id: string;
  action:
    | "refund"
    | "credit"
    | "chargeback"
    | "chargeback_warning"
    | "chargeback_reverse";
  status: "pending_approval" | "approved" | "rejected" | "reversed";
  transaction_id: string;
  subscription_id?: string;
  customer_id: string;
  reason?: string;
  totals?: {
    subtotal: string;
    total: string;
    currency_code: string;
  };
  created_at: string;
}

/** Customer — Paddle Customer(id ↔ 앱 사용자 연결 후보). */
export interface PaddleCustomer {
  id: string;
  email: string;
  name?: string;
  locale?: string;
  custom_data?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/** API Key 메타데이터 — 키 만료·폐기 알림 처리용. */
export interface PaddleApiKey {
  id: string;
  name: string;
  permissions: string[];
  expires_at?: string;
  created_at: string;
}

/** 노출 탐지 — 유출 발생 시 즉시 대응(회전·차단 알림). */
export interface PaddleApiKeyExposure {
  id: string;
  api_key_id: string;
  exposed_at: string;
  source?: string;
}

/** 클라이언트 토큰 — 프론트 결제 초기화 토큰 폐기 추적용. */
export interface PaddleClientToken {
  id: string;
  name: string;
  status: string;
  created_at: string;
}

/** ADR-0010 구독 이벤트 전체 discriminated union. */
export type PaddleWebhookEvent =
  | PaddleWebhookEnvelope<"transaction.completed", PaddleTransaction>
  | PaddleWebhookEnvelope<"transaction.payment_failed", PaddleTransaction>
  | PaddleWebhookEnvelope<"subscription.activated", PaddleSubscription>
  | PaddleWebhookEnvelope<"subscription.canceled", PaddleSubscription>
  | PaddleWebhookEnvelope<"subscription.past_due", PaddleSubscription>
  | PaddleWebhookEnvelope<"subscription.updated", PaddleSubscription>
  | PaddleWebhookEnvelope<"adjustment.created", PaddleAdjustment>
  | PaddleWebhookEnvelope<"customer.created", PaddleCustomer>
  | PaddleWebhookEnvelope<"api_key.expiring", PaddleApiKey>
  | PaddleWebhookEnvelope<"api_key.expired", PaddleApiKey>
  | PaddleWebhookEnvelope<"api_key.revoked", PaddleApiKey>
  | PaddleWebhookEnvelope<"api_key_exposure.created", PaddleApiKeyExposure>
  | PaddleWebhookEnvelope<"client_token.revoked", PaddleClientToken>;

const KNOWN_PADDLE_EVENT_TYPES: readonly PaddleEventType[] = [
  "transaction.completed",
  "transaction.payment_failed",
  "subscription.activated",
  "subscription.canceled",
  "subscription.past_due",
  "subscription.updated",
  "adjustment.created",
  "customer.created",
  "api_key.expiring",
  "api_key.expired",
  "api_key.revoked",
  "api_key_exposure.created",
  "client_token.revoked",
];

function knownPaddleEventType(t: unknown): t is PaddleEventType {
  return (
    typeof t === "string" &&
    (KNOWN_PADDLE_EVENT_TYPES as readonly string[]).includes(t)
  );
}

/**
 * `unknown`(JSON 파싱 직후 등) 에서 Paddle webhook envelope 형태 여부 검사만 수행합니다.
 * `data` 내부 스키마는 이벤트별 검증 단계에서 다시 확인합니다.
 */
export function isPaddleWebhookEvent(value: unknown): value is PaddleWebhookEvent {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;

  if (typeof v.event_id !== "string") return false;
  if (!knownPaddleEventType(v.event_type)) return false;
  if (typeof v.occurred_at !== "string") return false;
  if (typeof v.notification_id !== "string") return false;
  if (typeof v.data !== "object" || v.data === null) return false;

  return true;
}
