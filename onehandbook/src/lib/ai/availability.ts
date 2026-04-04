import type { LLMProviderId } from "@/lib/ai/types";

export function isProviderConfigured(provider: LLMProviderId): boolean {
  if (provider === "anthropic") {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  }
  if (provider === "google") {
    return Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
  }
  return false;
}
