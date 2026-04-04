import type { LLMProviderId } from "@/lib/ai/types";

/** 모든 분석은 동일 Claude 모델 — 플랫폼은 `platforms/{id}.md` 프롬프트만 분기 */
export const ANALYSIS_CLAUDE_MODEL = "claude-sonnet-4-5";

/**
 * 분석 프로필 — 서비스에서 표시명·프롬프트를 여기서 관리합니다.
 * - provider / model: 전 프로필 동일(Claude).
 * - id: DB `analysis_runs.agent_version`에 저장. 운영 중 id 변경은 피하세요.
 */
export type AnalysisProfileConfig = {
  id: string;
  label: string;
  description: string;
  provider: LLMProviderId;
  model: string;
  systemPromptFile?: string;
};

export const ANALYSIS_PROFILES: AnalysisProfileConfig[] = [
  {
    id: "kakao-page",
    label: "카카오페이지 분석",
    description: "액션·먼치킨·절벽 엔딩 기준 (Claude)",
    provider: "anthropic",
    model: ANALYSIS_CLAUDE_MODEL,
  },
  {
    id: "munpia",
    label: "문피아 분석",
    description: "가독성·사이다·고증·리얼리티 기준 (Claude)",
    provider: "anthropic",
    model: ANALYSIS_CLAUDE_MODEL,
  },
  {
    id: "naver-series",
    label: "네이버 시리즈 분석",
    description: "드라마·복선·문장 퀄리티 중심 (Claude)",
    provider: "anthropic",
    model: ANALYSIS_CLAUDE_MODEL,
  },
  {
    id: "generic",
    label: "범용 분석",
    description: "플랫폼 비특화 일반 점검 (Claude)",
    provider: "anthropic",
    model: ANALYSIS_CLAUDE_MODEL,
  },
];

/** 예전에 저장된 agent_version → 현재 프로필 id */
export const LEGACY_AGENT_VERSION_ALIASES: Record<string, string> = {
  "claude-3-5-haiku": "kakao-page",
  "claude-3-5-sonnet": "munpia",
  "gemini-2-flash": "generic",
  "gemini-1-5-flash": "naver-series",
  "gemini-flash-15": "naver-series",
  "gemini-flash": "generic",
};
