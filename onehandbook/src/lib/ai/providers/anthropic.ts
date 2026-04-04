import Anthropic from "@anthropic-ai/sdk";
import { AnalysisProviderExhaustedError } from "@/lib/analysis/analysisErrors";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getStatus(err: unknown): number | undefined {
  if (err && typeof err === "object" && "status" in err) {
    const s = (err as { status?: number }).status;
    return typeof s === "number" ? s : undefined;
  }
  return undefined;
}

/** 429 시 지수 백오프로 최대 3회 재시도(총 최대 4회 호출). 실패 시 NAT 미차감 안내용 에러 */
export async function completeAnthropic(params: {
  model: string;
  system: string;
  user: string;
}): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error("ANTHROPIC_API_KEY 가 설정되지 않았습니다.");
  }

  const client = new Anthropic({ apiKey: key });
  const maxRetries = 3;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const msg = await client.messages.create({
        model: params.model,
        max_tokens: 8192,
        temperature: 0,
        system: params.system,
        messages: [{ role: "user", content: params.user }],
      });

      const block = msg.content.find((b) => b.type === "text");
      if (block?.type !== "text") {
        throw new Error("Claude 응답에 텍스트가 없습니다.");
      }
      return block.text;
    } catch (e) {
      const status = getStatus(e);
      const retryable = status === 429 || status === 529;
      if (retryable && attempt < maxRetries) {
        const delayMs = 1000 * Math.pow(2, attempt);
        await sleep(delayMs);
        continue;
      }
      if (retryable) {
        throw new AnalysisProviderExhaustedError();
      }
      throw e;
    }
  }

  throw new Error("completeAnthropic: unreachable");
}
