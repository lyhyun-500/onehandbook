import type { LLMProviderId } from "./types";
import { ANALYSIS_PROFILES } from "@/config/analysis-profiles";
import { getProfileConfig } from "./profileLookup";

export interface AgentVersionConfig {
  id: string;
  label: string;
  description: string;
  provider: LLMProviderId;
  model: string;
}

/** UI·검증용 — id → 설정 */
export const AGENT_VERSIONS: Record<string, AgentVersionConfig> =
  Object.fromEntries(
    ANALYSIS_PROFILES.map((p) => [
      p.id,
      {
        id: p.id,
        label: p.label,
        description: p.description,
        provider: p.provider,
        model: p.model,
      },
    ])
  );

export const DEFAULT_AGENT_VERSION: string = ANALYSIS_PROFILES[0]!.id;

export function listAgentVersions(): AgentVersionConfig[] {
  return ANALYSIS_PROFILES.map((p) => AGENT_VERSIONS[p.id]!);
}

export function getAgentVersion(id: string): AgentVersionConfig | undefined {
  const p = getProfileConfig(id);
  return p ? AGENT_VERSIONS[p.id] : undefined;
}
