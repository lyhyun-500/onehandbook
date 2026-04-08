import type { AnalysisProfileConfig } from "@/config/analysis-profiles";
import type { AnalysisInput } from "./types";
import { buildGenreEvalAxesSection } from "./genreEvalAddons";
import { loadBaseSystem, loadPlatformSnippet } from "./loadAnalysisPrompt";

const LORE_DIMENSIONS = `## 작가 설정 대조 필수 차원
유저 메시지에 포함된 **세계관·인물 설정**(작가가 작품 설정에 저장한 값)을 원고와 반드시 대조하세요. 해당 설정이 비어 있으면 각 차원 comment에 그 제약을 명시하세요.

dimensions 객체에 **반드시** 아래 키 이름을 **정확히** 포함하고 각각 score(0-100 정수)·comment(한두 문장)를 채우세요:
- **캐릭터 일관성**: 작가가 제시한 성격·능력·목표와 원고 속 행동·대사·선택의 일치 정도. **점수가 높을수록** 설정과 행동이 잘 맞음.
- **세계관 고증 오류**: 작가가 제시한 배경·시대·세계관 규칙 대비 원고의 모순·파괴. **점수가 높을수록** 모순이 적고 설정을 잘 지킴.
- **인물 관계 활용도**: 설정에 적힌 인물 관계가 갈등·서사·전개에 활용된 정도. **점수가 높을수록** 관계 활용이 좋음.

위 세 항목은 장르별 평가 축·플랫폼 가이드와 별개로 **항상** 포함해야 합니다.`;

const JSON_SHAPE = `반드시 아래 키만 가진 JSON 하나만 출력하세요. 다른 설명·마크다운·코드펜스 금지.
{
  "overall_score": 0-100 정수,
  "dimensions": { "항목이름": { "score": 0-100 정수, "comment": "한두 문장" } },
  "improvement_points": ["개선점1", "개선점2", ...],
  "comparable_note": "선택: 유사 흥행작과 비교 한 문장"
}

**improvement_points 문장 규칙 (필수):** 각 항목은 **마크다운·장식 문법을 쓰지 마세요.** \`**\` (별표 굵게), \`*\`, \`#\`, 백틱(\` \`) 등은 절대 넣지 않습니다. 소제목처럼 보이게 할 때도 \`**장르 재설정 필수**: 설명\` 같은 형식이 아니라, \`장르 재설정 필수: 설명\`처럼 **일반 텍스트만** 사용하세요. 불릿 기호(-)도 넣지 말고 한 줄 문자열만 넣으세요.

**dimensions 키 규칙 (필수):** \`dimensions\` 객체의 **각 키는 서비스 화면에 그대로 노출**됩니다. 반드시 **한글 짧은 이름**만 사용하세요 (예: \`플롯 몰입도\`, \`문장 퀄리티\`). **영어·스네이크케이스**(\`plot_engagement\`, \`writing_quality\` 등)는 **절대 쓰지 마세요.** 위 장르별 평가 축·로어 차원에서 제시한 항목 이름을 키로 그대로 사용하면 됩니다.`;

export function buildSystemPrompt(
  genre: string,
  profile: AnalysisProfileConfig,
  trendsContextBlock?: string | null
): string {
  const base = loadBaseSystem().replace(/\{\{genre\}\}/g, genre);
  const genreAxes = buildGenreEvalAxesSection(genre);
  const platform = loadPlatformSnippet(profile);
  const parts = [base, genreAxes, LORE_DIMENSIONS, platform].filter(Boolean);
  const core = parts.join("\n\n");
  const trends = trendsContextBlock?.trim()
    ? `\n\n${trendsContextBlock.trim()}`
    : "";
  return `${core}${trends}\n\n${JSON_SHAPE}`;
}

export function formatLoreContextForAnalysis(input: AnalysisInput): string {
  const w = input.world_setting;
  const chars = input.character_settings ?? [];
  const lines: string[] = [];

  const hasWorld =
    w &&
    [w.background, w.era, w.rules].some(
      (s) => typeof s === "string" && s.trim().length > 0
    );

  if (hasWorld) {
    lines.push("--- 작가 제공 세계관 설정 ---");
    if (w!.background?.trim()) lines.push(`배경: ${w!.background!.trim()}`);
    if (w!.era?.trim()) lines.push(`시대: ${w!.era!.trim()}`);
    if (w!.rules?.trim())
      lines.push(`세계관 규칙: ${w!.rules!.trim()}`);
    lines.push("");
  } else {
    lines.push(
      "(작가가 세계관 설정을 비워 두었습니다. 세계관 고증 차원에서는 설정 부재를 명시하세요.)"
    );
    lines.push("");
  }

  const filled = chars.filter((c) => c.name?.trim());
  if (filled.length > 0) {
    lines.push("--- 작가 제공 인물 설정 ---");
    filled.forEach((c, i) => {
      lines.push(`[인물 ${i + 1}] ${c.name.trim()} (${c.role?.trim() || "미지정"})`);
      if (c.personality?.trim())
        lines.push(`  성격: ${c.personality.trim()}`);
      if (c.abilities?.trim())
        lines.push(`  능력: ${c.abilities.trim()}`);
      if (c.goals?.trim()) lines.push(`  목표: ${c.goals.trim()}`);
      if (c.relationships?.trim())
        lines.push(`  인물 간 관계: ${c.relationships.trim()}`);
      lines.push("");
    });
  } else {
    lines.push(
      "(작가가 인물 설정을 비워 두었습니다. 캐릭터 일관성·인물 관계 활용도 차원에서는 설정 부재를 명시하세요.)"
    );
    lines.push("");
  }

  return lines.join("\n");
}

export function buildUserPrompt(input: AnalysisInput): string {
  const excerpt =
    input.manuscript.length > 120_000
      ? `${input.manuscript.slice(0, 120_000)}\n\n[이하 생략: 원고가 길어 앞부분만 전달됨]`
      : input.manuscript;

  const lore = formatLoreContextForAnalysis(input);

  const prevBlock =
    typeof input.previous_episodes_context === "string" &&
    input.previous_episodes_context.trim().length > 0
      ? `${input.previous_episodes_context.trim()}\n\n`
      : "";

  const continuityHint = prevBlock
    ? `이전 회차 요약은 연속성·맥락 참고용입니다. JSON의 점수·코멘트는 반드시 아래 원고 본문만 대상으로 하세요.\n\n`
    : "";

  return `${lore}${prevBlock}${continuityHint}장르: ${input.genre}

다음 원고를 분석해 JSON으로만 답하세요.

--- 원고 시작 ---
${excerpt}
--- 원고 끝 ---`;
}
