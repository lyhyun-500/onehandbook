"use client";

/**
 * ADR-0010 (Phase 3a): Paddle Sandbox 결제 시스템
 *
 * 목적
 * - Paddle 인스턴스 초기화(싱글톤)
 * - 결제창 오픈 헬퍼(openCheckout)
 *
 * 주의
 * - clientToken은 NEXT_PUBLIC 환경변수만 사용 (시크릿은 서버 전용)
 */

import { initializePaddle, type Paddle } from "@paddle/paddle-js";
import { PADDLE_CLIENT_CONFIG } from "./config";

let paddlePromise: Promise<Paddle | undefined> | null = null;

export async function getPaddle(): Promise<Paddle | undefined> {
  if (!paddlePromise) {
    paddlePromise = initializePaddle({
      environment: PADDLE_CLIENT_CONFIG.environment,
      token: PADDLE_CLIENT_CONFIG.clientToken,
    }).catch((e) => {
      console.error("[paddle] initializePaddle 실패:", e);
      return undefined;
    });
  }
  return paddlePromise;
}

export async function openCheckout(
  priceId: string,
  options?: {
    customerEmail?: string;
    customData?: Record<string, string>;
  }
): Promise<void> {
  const paddle = await getPaddle();
  if (!paddle) {
    throw new Error("[paddle] Paddle 초기화에 실패했습니다.");
  }

  const customerEmail = options?.customerEmail?.trim();

  paddle.Checkout.open({
    items: [{ priceId, quantity: 1 }],
    ...(customerEmail ? { customer: { email: customerEmail } } : {}),
    ...(options?.customData ? { customData: options.customData } : {}),
  });
}

