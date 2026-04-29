/**
 * ADR-0010 Phase 3a Step 3-3-C — Paddle Billing Webhook (Sandbox 수신·검증·저장·백그라운드 분기)
 *
 * Paddle Webhook 개요:
 * https://developer.paddle.com/webhooks/overview
 *
 * Step 3-3/3-4 에서 이벤트별 NAT 처리·큐 분기 추가 예정.
 * 이 라우트는 **수신 + DB 멱등 저장 + 200** 까지만 수행합니다.
 */

import { waitUntil } from "@vercel/functions";
import { NextRequest, NextResponse } from "next/server";
import { getPaddleServerConfig } from "@/lib/paddle/config";
import { processPaddleWebhookEvent } from "@/lib/paddle/event-handler";
import { isPaddleWebhookEvent } from "@/lib/paddle/event-types";
import { verifyPaddleSignature } from "@/lib/paddle/webhook-verify";
import { createSupabaseServiceRole } from "@/lib/supabase/serviceRole";

export const runtime = "nodejs";

const WEBHOOK_ENV = "sandbox" as const;

function extractNotificationId(event: unknown): string | null {
  if (!event || typeof event !== "object") return null;
  const v = (event as Record<string, unknown>).notification_id;
  if (typeof v === "string" && v.trim().length > 0) return v.trim();
  return null;
}

function extractEventType(event: unknown): string {
  if (!event || typeof event !== "object") return "unknown";
  const v = (event as Record<string, unknown>).event_type;
  if (typeof v === "string" && v.trim().length > 0) return v.trim();
  return "unknown";
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch (e) {
    console.error("[paddle webhook sandbox] 요청 본문 읽기 실패:", e);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }

  const signatureHeader = req.headers.get("paddle-signature");

  let webhookSecret: string;
  try {
    webhookSecret = getPaddleServerConfig().webhookSecret;
  } catch (e) {
    console.error("[paddle webhook sandbox] Paddle 서버 설정 로드 실패:", e);
    return NextResponse.json({ error: "server_config" }, { status: 500 });
  }

  const verification = verifyPaddleSignature({
    rawBody,
    signatureHeader,
    secret: webhookSecret,
  });

  if (!verification.valid) {
    console.error(
      "[paddle webhook sandbox] 서명 검증 실패:",
      verification.reason ?? "unknown"
    );
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let event: unknown;
  try {
    event = JSON.parse(rawBody) as unknown;
  } catch (e) {
    console.error("[paddle webhook sandbox] JSON 파싱 실패:", e);
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const notificationId = extractNotificationId(event);
  if (!notificationId) {
    /** 영구적으로 멱등 키를 만들 수 없음 → 재시도해도 동일 실패 가능성이 높아 200으로 핑크(ping) 종료 */
    console.error(
      "[paddle webhook sandbox] notification_id 없음 — payload 스키마 확인 필요"
    );
    return NextResponse.json({ ok: false, skipped: true }, { status: 200 });
  }

  const eventType = extractEventType(event);
  console.log("[paddle webhook sandbox] 수신:", {
    event_type: eventType,
    notification_id: notificationId,
  });

  try {
    const supabase = createSupabaseServiceRole();

    const { data: existing, error: selectError } = await supabase
      .from("paddle_webhooks")
      .select("id, processed_at")
      .eq("id", notificationId)
      .maybeSingle();

    if (selectError) {
      console.error("[paddle webhook sandbox] paddle_webhooks 조회 실패:", selectError);
      return NextResponse.json({ error: "db_error" }, { status: 500 });
    }

    if (existing?.processed_at != null) {
      return NextResponse.json({ ok: true, idempotent: true }, { status: 200 });
    }

    const { error: upsertError } = await supabase.from("paddle_webhooks").upsert(
      {
        id: notificationId,
        event_type: eventType,
        environment: WEBHOOK_ENV,
        payload: event as object,
        processed_at: null,
      },
      { onConflict: "id" }
    );

    if (upsertError) {
      console.error("[paddle webhook sandbox] paddle_webhooks upsert 실패:", upsertError);
      return NextResponse.json({ error: "db_error" }, { status: 500 });
    }

    if (!isPaddleWebhookEvent(event)) {
      console.error("[paddle webhook sandbox] 알 수 없는 webhook 이벤트 형식:", {
        notification_id: notificationId,
        event_type: eventType,
      });
      // 영구 에러 성격(알 수 없는 형식)이라 200으로 종료해 Paddle 재시도를 막는다.
      return NextResponse.json({ ok: true, unknown_event: true }, { status: 200 });
    }

    waitUntil(
      processPaddleWebhookEvent(event).catch((err) => {
        console.error("[paddle webhook sandbox] 백그라운드 처리 실패:", err);
        // 수신/저장은 성공했으므로 webhook 응답은 성공 유지.
        // Cron 워커가 processed_at IS NULL 행을 재처리할 수 있다.
      })
    );

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error("[paddle webhook sandbox] 처리 중 예외:", e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
