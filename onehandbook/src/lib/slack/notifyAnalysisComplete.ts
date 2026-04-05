/**
 * 분석 완료 시 슬랙 Incoming Webhook으로 알림 (선택).
 * `SLACK_WEBHOOK_URL` 미설정 시 no-op.
 */
export async function notifySlackAnalysisComplete(payload: {
  workTitle: string;
  episodeLabel: string;
  workId: number;
  episodeId: number;
}): Promise<void> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url || typeof url !== "string" || !url.startsWith("https://")) {
    return;
  }

  const text = [
    "✅ *AI 분석 완료*",
    `작품: *${payload.workTitle}*`,
    `회차: ${payload.episodeLabel}`,
    `결과: /works/${payload.workId}/analysis?focus=${payload.episodeId}`,
  ].join("\n");

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch (e) {
    console.warn("notifySlackAnalysisComplete:", e);
  }
}
