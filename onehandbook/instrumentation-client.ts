// Client-side Sentry — DSN은 빌드 시 NEXT_PUBLIC_SENTRY_DSN으로 주입(next.config)
// Slack 웹훅은 서버 전용이므로 클라이언트에서는 호출하지 않습니다.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: process.env.NODE_ENV === "development" ? 0.5 : 0.1,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
