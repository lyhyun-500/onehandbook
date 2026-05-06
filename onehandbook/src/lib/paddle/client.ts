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

import {
  CheckoutEventNames,
  initializePaddle,
  type Paddle,
} from "@paddle/paddle-js";
import { PADDLE_CLIENT_CONFIG } from "./config";

let paddlePromise: Promise<Paddle | undefined> | null = null;

/**
 * `eventCallback` 은 initializePaddle 시점에만 등록 가능하고,
 * Checkout.open 호출별 콜백을 동적으로 바꾸려면 모듈 레벨 ref 가 필요하다.
 * 한 사용자 세션에 한 번에 하나의 checkout 만 활성이라 race 위험 없음.
 */
let currentCallbacks: {
  onSuccess?: () => void;
  onClose?: () => void;
} = {};

export async function getPaddle(): Promise<Paddle | undefined> {
  if (!paddlePromise) {
    paddlePromise = initializePaddle({
      environment: PADDLE_CLIENT_CONFIG.environment,
      token: PADDLE_CLIENT_CONFIG.clientToken,
      eventCallback: (event) => {
        if (event.name === CheckoutEventNames.CHECKOUT_COMPLETED) {
          currentCallbacks.onSuccess?.();
        } else if (event.name === CheckoutEventNames.CHECKOUT_CLOSED) {
          currentCallbacks.onClose?.();
        }
      },
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
    onSuccess?: () => void;
    onClose?: () => void;
  }
): Promise<void> {
  const paddle = await getPaddle();
  if (!paddle) {
    throw new Error("[paddle] Paddle 초기화에 실패했습니다.");
  }

  // 이전 호출 잔재 콜백 청소 후 갱신.
  currentCallbacks = {
    onSuccess: options?.onSuccess,
    onClose: options?.onClose,
  };

  const customerEmail = options?.customerEmail?.trim();

  paddle.Checkout.open({
    items: [{ priceId, quantity: 1 }],
    ...(customerEmail ? { customer: { email: customerEmail } } : {}),
    ...(options?.customData ? { customData: options.customData } : {}),
  });
}

