import type { AnalysisProfileConfig } from "@/config/analysis-profiles";
import { buildGenreEvalAxesSection } from "./genreEvalAddons";
import { loadBaseSystem, loadPlatformSnippet } from "./loadAnalysisPrompt";
import type { HolisticAnalysisResult } from "./types";

const MERGE_JSON_SHAPE = `반드시 아래 키만 가진 JSON 하나만 출력하세요. 다른 설명·마크다운·코드펜스 금지.
{
  "overall_score": 0-100 정수,
  "episode_scores": [
    { "episode_number": 회차번호, "episode_title": "선택", "score": 0-100 정수 }
  ],
  "dimensions": {
    "플로우 일관성": { "score": 0-100 정수, "comment": "한두 문장" },
    "캐릭터 아크": { "score": 0-100 정수, "comment": "한두 문장" },
    "복선 활용도": { "score": 0-100 정수, "comment": "한두 문장" },
    "플랫폼 적합성": { "score": 0-100 정수, "comment": "한두 문장" }
  },
  "strengths": ["잘된 점 한 줄", "..."],
  "improvements": ["개선이 필요한 점 한 줄", "..."],
  "executive_summary": "에이전트 최종 총평을 한 문단으로 작성"
}

**규칙:** 유저가 제공한 배치별 JSON을 바탕으로 **전체 선택 구간**을 하나의 작품 흐름으로 통합 평가하세요. episode_scores에는 **모든 회차**가 빠짐없이 들어가야 합니다(배치에 있던 점수를 재검토·조정 가능). overall_score는 episode_scores와 각 회차 글자 수 가중(유저 메시지에 제시)과 일치하도록 하세요. strengths·improvements는 마크다운 굵게 등 사용 금지.`;

export function buildHolisticMergeSystemPrompt(
  genre: string,
  profile: AnalysisProfileConfig
): string {
  const base = loadBaseSystem().replace(/\{\{genre\}\}/g, genre);
  const genreAxes = buildGenreEvalAxesSection(genre);
  const platform = loadPlatformSnippet(profile);
  const task = `## 통합 병합 임무
아래는 **동일 작품**의 일부 구간을 10화 단위로 나누어 각각 분석한 JSON 결과들입니다. 원고 전문은 다시 주어지지 않습니다. 배치별 점수·코멘트·요약만으로 **전체 구간의 흐름**을 일관되게 재구성한 **단일 종합 리포트** JSON을 출력하세요.`;

  const parts = [base, task, genreAxes, platform].filter(Boolean);
  return `${parts.join("\n\n")}\n\n${MERGE_JSON_SHAPE}`;
}

export type HolisticChunkPayload = {
  chunkIndex: number;
  /** 예: "1~10화" */
  rangeLabel: string;
  result: HolisticAnalysisResult;
};

export function buildHolisticMergeUserPrompt(
  genre: string,
  chunks: HolisticChunkPayload[],
  episodeWeights: Array<{ episode_number: number; charCount: number }>
): string {
  const weightLines = episodeWeights
    .map((w) => `${w.episode_number}화: 약 ${w.charCount.toLocaleString()}자`)
    .join("\n");

  const chunkJson = chunks.map((c) => ({
    chunk_index: c.chunkIndex,
    range: c.rangeLabel,
    partial: c.result,
  }));

  const payload =
    JSON.stringify(chunkJson, null, 0).length > 120_000
      ? JSON.stringify(chunkJson)
      : JSON.stringify(chunkJson, null, 2);

  return `장르: ${genre}

회차별 가중치(종합 점수 산출 시 사용):
${weightLines}

배치별 분석 JSON (원고 본문 없음, 요약·점수만):
${payload}

위 배치들을 통합한 단일 JSON으로만 답하세요.`;
}
