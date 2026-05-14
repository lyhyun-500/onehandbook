import { ANALYSIS_PROFILES } from "@/config/analysis-profiles";

/**
 * agent_version → 플랫폼 한글 라벨 본질.
 *
 * 분석 데이터의 플랫폼 영역은 `agent_version` 컬럼에 인코딩됨
 * (`kakao-page` / `munpia` / `naver-series` / `generic` / 그 외 = e2e mock 등).
 *
 * generic / lookup 실패 영역 = null 반환 본질 — 호출처에서 "—" 표시 결정.
 */
export function getAgentPlatformLabel(
  agentVersion: string | null | undefined,
): string | null {
  if (!agentVersion) return null;
  const profile = ANALYSIS_PROFILES.find((p) => p.id === agentVersion);
  if (!profile) return null;
  if (profile.id === "generic") return null;
  // label 본질 = "카카오페이지 분석" / "문피아 분석" / "네이버 시리즈 분석" → "분석" 접미 제거.
  return profile.label.replace(/\s*분석\s*$/, "");
}
