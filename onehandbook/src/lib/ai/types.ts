/** 분석 프로필 id — `config/analysis-profiles.ts` 의 id 와 동일 */
export type AgentVersionId = string;

/** works.world_setting JSON — 분석 시 컨텍스트 */
export type AnalysisWorldSetting = {
  background?: string;
  era?: string;
  rules?: string;
};

/** works.character_settings 배열 항목 */
export type AnalysisCharacterSetting = {
  name: string;
  role?: string;
  personality?: string;
  abilities?: string;
  goals?: string;
  relationships?: string;
};

export interface AnalysisInput {
  /** 분석할 원고 본문 */
  manuscript: string;
  /** works.genre 등과 맞춤 */
  genre: string;
  /** 작품 설정 — 비어 있으면 모델에 제약 안내 */
  world_setting?: AnalysisWorldSetting;
  character_settings?: AnalysisCharacterSetting[];
  /**
   * 동일 작품 이전 회차들의 분석 결과 요약(캐시된 요약만).
   * 원고 본문 전체가 아님.
   */
  previous_episodes_context?: string;
}

/**
 * 모델이 반환해야 하는 JSON 구조 (프롬프트와 동일하게 유지)
 */
export interface AnalysisResult {
  overall_score: number;
  dimensions: Record<string, { score: number; comment: string }>;
  improvement_points: string[];
  comparable_note?: string;
}

/** 일괄 통합 분석(다회차 한 번에) — 모델 JSON */
export interface HolisticEpisodeScore {
  episode_number: number;
  episode_title?: string;
  score: number;
}

export interface HolisticAnalysisResult {
  overall_score: number;
  episode_scores: HolisticEpisodeScore[];
  dimensions: Record<string, { score: number; comment: string }>;
  strengths: string[];
  improvements: string[];
  executive_summary: string;
}

export type LLMProviderId = "anthropic" | "google";
