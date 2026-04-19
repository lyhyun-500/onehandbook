import type { AnalysisProfileConfig } from "@/config/analysis-profiles";
import { buildGenreEvalAxesSection } from "./genreEvalAddons";
import { loadBaseSystem, loadPlatformSnippet } from "./loadAnalysisPrompt";
import type { AnalysisInput } from "./types";
import { formatLoreContextForAnalysis } from "./prompts";

const HOLISTIC_JSON_SHAPE = `반드시 아래 키만 가진 JSON 하나만 출력하세요. 다른 설명·마크다운·코드펜스 금지.
{
  "overall_score": 0-100 정수,
  "episode_scores": [
    {
      "episode_number": 회차번호,
      "episode_title": "해당 회차 제목(선택)",
      "score": 0-100 정수,
      "dimensions": {
        "플로우 일관성": { "score": 0-100 정수, "comment": "이 회차의 본문을 근거로 한 한 문장" },
        "캐릭터 아크": { "score": 0-100 정수, "comment": "이 회차의 본문을 근거로 한 한 문장" },
        "복선 활용도": { "score": 0-100 정수, "comment": "이 회차의 본문을 근거로 한 한 문장" },
        "플랫폼 적합성": { "score": 0-100 정수, "comment": "이 회차의 본문을 근거로 한 한 문장" }
      },
      "improvements": ["이 회차만의 개선점 한 줄", "..."],
      "comment": "이 회차만의 총평 한 문단"
    }
  ],
  "dimensions": {
    "플로우 일관성": { "score": 0-100 정수, "comment": "한두 문장" },
    "캐릭터 아크": { "score": 0-100 정수, "comment": "한두 문장" },
    "복선 활용도": { "score": 0-100 정수, "comment": "한두 문장" },
    "플랫폼 적합성": { "score": 0-100 정수, "comment": "한두 문장" }
  },
  "strengths": ["잘된 점 한 줄", "..."],
  "improvements": ["개선이 필요한 점 한 줄", "..."],
  "tag_trend_fit": {
    "alignment": "선택: 유저 태그가 해당 플랫폼의 현재 트렌드 태그와 얼마나 일치하는지 (2~4문장)",
    "differentiation": "선택: 태그 관점에서 차별화되는 포인트/리스크/보완 전략 (2~4문장)",
    "suggested_trend_tags": ["선택: 함께 쓰기 좋은 보조 태그", "..."]
  },
  "executive_summary": "에이전트 최종 총평을 한 문단으로 작성"
}

**규칙 (필수):**
- 유저 메시지에 포함된 **모든 회차**에 대해 episode_scores에 항목을 넣으세요. 회차 순서는 유저가 제시한 순서와 같아야 합니다.
- episode_scores 각 원소의 dimensions, improvements, comment는 **해당 회차 본문만을 근거로** 작성하세요. 전체 통합 관점이 아닙니다.
- 최상위 dimensions, improvements, executive_summary는 **전체 통합 관점**으로 작성하세요. 회차별 필드와 역할이 다릅니다.
- overall_score는 각 회차 score를 해당 회차 원고 글자 수(유저 메시지에 표시됨)로 가중한 값과 **일치**하도록 하세요. 가중 평균 = Σ(score_i × 글자수_i) / Σ(글자수_i), 반올림하여 정수.
- strengths·improvements 각 항목 문자열에 마크다운 굵게(\`**\`)·이탤릭·# 제목·불릿 기호를 넣지 마세요. 일반 문장만.
- dimensions 키 이름은 위 네 가지 **한글 이름을 정확히** 사용하세요.`;

const HOLISTIC_TASK = `## 통합 분석 임무
아래 원고는 **여러 회차를 시간 순으로 이어 붙인 것**입니다. 각 회차 구간은 제목으로 구분되어 있습니다.
**작품 전체 서사·톤·인물 호흡이 회차 간에 어떻게 이어지는지**를 중심으로 평가하세요. 단일 회차 품질만 보지 말고, 연속된 흐름·아크·복선이 구간 전체에서 어떻게 작동하는지 봅니다.
플랫폼 적합성 차원은 선택된 분석 프로필(플랫폼 가이드)에 맞춰 판단하되, 범용 모드일 때는 일반 웹소설 독자 기대에의 적합도로 해석하세요.`;

const KOREAN_LINEBREAK_RULE = `## 문단·줄바꿈 규칙 (필수)
- 쉼표(,) 뒤에서 줄바꿈/문단 분리를 하지 마세요. (예: "A,\\nB" 금지)
- 줄바꿈은 문단을 나눌 때만 사용하고, 한 문장 안에서는 줄을 끊지 마세요.
- 결과 JSON의 문자열 필드(comment, alignment 등)도 같은 규칙을 적용하세요.`;

export function buildHolisticSystemPrompt(
  genre: string,
  profile: AnalysisProfileConfig,
  trendsContextBlock?: string | null
): string {
  const base = loadBaseSystem().replace(/\{\{genre\}\}/g, genre);
  const genreAxes = buildGenreEvalAxesSection(genre);
  const platform = loadPlatformSnippet(profile);
  const parts = [
    base,
    HOLISTIC_TASK,
    genreAxes,
    platform,
    KOREAN_LINEBREAK_RULE,
  ].filter(Boolean);
  const core = parts.join("\n\n");
  const trends = trendsContextBlock?.trim()
    ? `\n\n${trendsContextBlock.trim()}`
    : "";
  return `${core}${trends}\n\n${HOLISTIC_JSON_SHAPE}`;
}

export type HolisticEpisodeSegment = {
  episode_number: number;
  title: string;
  content: string;
  charCount: number;
};

const HOLISTIC_MAX_COMBINED_CHARS = 200_000;

export function buildHolisticUserPrompt(
  genre: string,
  loreInput: AnalysisInput,
  segments: HolisticEpisodeSegment[]
): string {
  const lore = formatLoreContextForAnalysis(loreInput);
  const tags = Array.isArray(loreInput.tags)
    ? loreInput.tags
        .map((t) => String(t ?? "").trim().replace(/^#+/, "").trim())
        .filter(Boolean)
        .slice(0, 12)
    : [];
  const persona =
    tags.length > 0
      ? `작품 태그(페르소나): 이 작품은 ${tags.map((t) => `#${t}`).join(" ")} 성격을 가진 작품이다.\n\n`
      : "";
  const lines: string[] = [];
  let used = 0;
  let truncated = false;

  for (const seg of segments) {
    const header = `\n\n=== ${seg.episode_number}화 · ${seg.title} (약 ${seg.charCount.toLocaleString()}자) ===\n`;
    const room = HOLISTIC_MAX_COMBINED_CHARS - used - header.length;

    if (room <= 0) {
      truncated = true;
      const fallback =
        `\n\n=== ${seg.episode_number}화 · ${seg.title || "제목 없음"} ===\n` +
        `[본문: 통합 원고 ${HOLISTIC_MAX_COMBINED_CHARS.toLocaleString()}자 한도로 이 회차는 넣지 못했습니다. ` +
        `JSON의 episode_scores에 **반드시 ${seg.episode_number}화** 항목을 넣고, 앞선 구간·작품 맥락만으로 점수를 매기세요.]\n`;
      if (used + fallback.length > HOLISTIC_MAX_COMBINED_CHARS) {
        const micro = `\n[${seg.episode_number}화 본문 생략 — episode_scores에 ${seg.episode_number}화 포함 필수]\n`;
        if (used + micro.length > HOLISTIC_MAX_COMBINED_CHARS) break;
        lines.push(micro);
        used += micro.length;
        continue;
      }
      lines.push(fallback);
      used += fallback.length;
      continue;
    }

    let body = seg.content;
    if (body.length > room) {
      body = `${body.slice(0, room)}\n\n[이하 생략: 통합 분석용 글자 수 한도]`;
      truncated = true;
    }
    lines.push(header + body);
    used += header.length + body.length;
  }

  const manuscriptBlock = lines.join("");

  return `${lore}${persona}장르: ${genre}

다음은 선택된 회차들을 **순서대로** 이어 붙인 통합 원고입니다. 위 JSON 형식으로만 답하세요.
${truncated ? "\n(일부 회차 본문이 길이 한도로 잘리거나 생략되었을 수 있습니다. 생략된 회차도 episode_scores에 반드시 포함하세요.)\n" : ""}

--- 통합 원고 시작 ---
${manuscriptBlock}
--- 통합 원고 끝 ---`;
}
