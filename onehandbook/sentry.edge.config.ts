// Edge / 네트워크 경계(Sentry가 잡는 영역)용 — Slack 알림은 서버와 동일 로직

import * as Sentry from "@sentry/nextjs";
import { notifySlackForSentryEvent } from "./src/lib/sentry/notifySlack";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: process.env.NODE_ENV === "development" ? 0.5 : 0.1,
    beforeSend(event, hint) {
      void notifySlackForSentryEvent(event, hint);
      return event;
    },
  });
}
