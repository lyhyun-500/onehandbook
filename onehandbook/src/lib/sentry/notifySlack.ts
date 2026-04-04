import type { Event, EventHint } from "@sentry/core";

/**
 * Sentry 이벤트를 Slack Incoming Webhook으로 전달 (서버·엣지 전용).
 * SLACK_WEBHOOK_URL 미설정 시 noop.
 */
export async function notifySlackForSentryEvent(
  event: Event,
  hint: EventHint
): Promise<void> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return;

  const ex = event.exception?.values?.[0];
  const title = ex?.type ?? "Error";
  const value = ex?.value;
  const err = hint.originalException;
  const message =
    typeof value === "string" && value
      ? value
      : err instanceof Error
        ? err.message
        : typeof err === "string"
          ? err
          : "Unknown error";

  const env = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown";
  const release = event.release ? `\nrelease: \`${event.release}\`` : "";
  const requestUrl = event.request?.url ? `\nurl: ${event.request.url}` : "";

  const text = [
    `*[novel-agent] Sentry 오류* · \`${env}\``,
    `*${title}*`,
    "```",
    message,
    "```",
    event.event_id ? `event_id: \`${event.event_id}\`` : "",
    `${release}${requestUrl}`,
  ]
    .filter((line) => line !== "")
    .join("\n");

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch (e) {
    console.error("[notifySlackForSentryEvent]", e);
  }
}
