// This file configures the initialization for Sentry on the server (Node.js).
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

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
