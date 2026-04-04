import {
  ANALYSIS_PROFILES,
  LEGACY_AGENT_VERSION_ALIASES,
  type AnalysisProfileConfig,
} from "@/config/analysis-profiles";

/** DB 등에 저장된 값(구 id 포함) → 현재 프로필 id */
export function resolveCanonicalProfileId(raw: string): string {
  return LEGACY_AGENT_VERSION_ALIASES[raw] ?? raw;
}

export function getProfileConfig(raw: string): AnalysisProfileConfig | undefined {
  const id = resolveCanonicalProfileId(raw);
  return ANALYSIS_PROFILES.find((p) => p.id === id);
}

/** UI 표시용 — 클라이언트에서도 사용 (fs 없음) */
export function getProfileLabel(storedId: string): string {
  const p = getProfileConfig(storedId);
  return p?.label ?? storedId;
}
