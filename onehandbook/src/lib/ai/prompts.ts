import type { AnalysisProfileConfig } from "@/config/analysis-profiles";
import type { AnalysisInput } from "./types";
import { buildGenreEvalAxesSection } from "./genreEvalAddons";
import {
  loadBaseSystem,
  loadPlatformSnippet,
  loadSerializationSegmentGuide,
} from "./loadAnalysisPrompt";

// CLAUDE.md §4 영속화: 신규 분석 = 한글 키 6축 고정 사양 정합.
// 단계 D-fixup-7 (결정 63~65): 4축 회귀 사실 정정 → 6축 항상 보장 정합.
const CORE_DIMENSIONS = `## 핵심 평가 6 축 (필수)

dimensions 객체에 **반드시** 아래 6 축을 **모두** 포함하고 각각 score(0-100 정수)·comment(한두 문장)를 채우세요. 한글 키를 그대로 JSON 키로 사용하세요 (영어 키 금지):

- **첫 훅·몰입**: 회차 시작 3페이지 안에 독자 시선을 잡는 강도. 회상·전사·인물 등장 방식이 평가 대상.
- **인물 매력**: 주인공의 내적 갈등·관계 묘사·반응 일관성. 시점 변화 시 캐릭터 통합도 포함.
- **세계관**: 배경·시대·규칙 정합. 대사 설명 vs 시각 디테일 균형, 정보 노출 속도.
- **긴장감**: 씬 단위 갈등 강도와 호흡. 떡밥 회수 패턴, 중반 평탄 구간 진단.
- **로맨스·감정선**: 주 감정 외 보조 레이어 (분노·서글픔·환희·체념 등) 표현 두께.
- **독창성**: 장르 클리셰 사용·변주 정도. 같은 장르 상위작 패턴 대비 차별 지점.

위 6 축은 장르별 평가 축·로어 차원·플랫폼 가이드와 별개로 **항상** 포함하세요.`;

// ADR-0031 정합: 프롤로그 (작품 도입부) 전용 평가 사양. 6 축 본질 유지, 평가 관점 단독 갱신.
const PROLOGUE_DIMENSIONS = `## 본 회차 = 프롤로그 평가 사양 (필수)

본 회차는 **프롤로그** (작품 시작 전 도입부)입니다. dimensions 객체에 **반드시** 아래 6 축을 **모두** 포함하고 각각 score(0-100 정수)·comment(한두 문장)를 채우세요. 한글 키를 그대로 JSON 키로 사용하세요 (영어 키 금지):

- **첫 훅·몰입**: 프롤로그의 핵심 기능 = 독자 시선을 즉시 사로잡기 + 작품 정체성에 대한 첫 인상. 본 차원에 **가중치 50%** 부여하여 엄격하게 평가.
- **인물 매력**: 주요 인물의 첫 등장 + 매력의 임팩트 단독 평가. 성장·반응 일관성은 평가 대상이 아님. 한두 인물의 깊이 우선.
- **세계관**: 작품 정체성의 prelude — 배경·분위기·톤 단독 평가. 세계관 규칙 설명은 일반 회차와 동일하게 평가.
- **긴장감**: 후속 회차를 끌어당기는 미스터리·갈등·떡밥 단독 평가. 본 회차 내 갈등 해소 여부는 평가 대상이 아님.
- **로맨스·감정선**: 프롤로그에서는 본격 감정선이 없는 것이 자연스러움. 도입의 감정 톤 단독 평가.
- **독창성**: 작품 차별화의 첫 신호 단독 평가 (장르 클리셰 변주 포함).

위 6 축은 장르별 평가 축·로어 차원·플랫폼 가이드와 별개로 **항상** 포함하세요. 본 회차는 프롤로그이므로 연속성·중반 호흡·인물 성장 같은 일반 회차 평가 관점은 적용하지 마세요.`;

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
  "tag_trend_fit": {
    "alignment": "선택: 유저 태그가 해당 플랫폼의 현재 트렌드 태그와 얼마나 일치하는지 (2~4문장)",
    "differentiation": "선택: 태그 관점에서 차별화되는 포인트/리스크/보완 전략 (2~4문장)",
    "suggested_trend_tags": ["선택: 함께 쓰기 좋은 보조 태그", "..."]
  },
  "comparable_note": "선택: 유사 흥행 웹 연재작과 비교 한 문장(네이버 시리즈·카카오페이지·문피아 연재 웹소설·웹툰만; 드라마·영화·단행본 등 타 매체 작품명·비유 금지)"
}

**improvement_points 문장 규칙 (필수):** 각 항목은 **마크다운·장식 문법을 쓰지 마세요.** \`**\` (별표 굵게), \`*\`, \`#\`, 백틱(\` \`) 등은 절대 넣지 않습니다. 소제목처럼 보이게 할 때도 \`**장르 재설정 필수**: 설명\` 같은 형식이 아니라, \`장르 재설정 필수: 설명\`처럼 **일반 텍스트만** 사용하세요. 불릿 기호(-)도 넣지 말고 한 줄 문자열만 넣으세요.

**dimensions 키 규칙 (필수):** \`dimensions\` 객체의 **각 키는 서비스 화면에 그대로 노출**됩니다. 반드시 **한글 짧은 이름**만 사용하세요 (예: \`플롯 몰입도\`, \`문장 퀄리티\`). **영어·스네이크케이스**(\`plot_engagement\`, \`writing_quality\` 등)는 **절대 쓰지 마세요.** 위 장르별 평가 축·로어 차원에서 제시한 항목 이름을 키로 그대로 사용하면 됩니다.`;

const KOREAN_LINEBREAK_RULE = `## 문단·줄바꿈 규칙 (필수)
- 쉼표(,) 뒤에서 줄바꿈/문단 분리를 하지 마세요. (예: "A,\\nB" 금지)
- 줄바꿈은 문단을 나눌 때만 사용하고, 한 문장 안에서는 줄을 끊지 마세요.
- 결과 JSON의 문자열 필드(comment, alignment 등)도 같은 규칙을 적용하세요.`;

export function buildSystemPrompt(
  genre: string,
  profile: AnalysisProfileConfig,
  trendsContextBlock?: string | null,
  workContextBlock?: string | null,
  episodeType?: "episode" | "prologue",
): string {
  const base = loadBaseSystem().replace(/\{\{genre\}\}/g, genre);
  const serialization = loadSerializationSegmentGuide();
  const genreAxes = buildGenreEvalAxesSection(genre);
  const platform = loadPlatformSnippet(profile);
  const isPrologue = episodeType === "prologue";
  const parts = [
    base,
    serialization,
    isPrologue ? PROLOGUE_DIMENSIONS : CORE_DIMENSIONS,
    genreAxes,
    LORE_DIMENSIONS,
    platform,
    KOREAN_LINEBREAK_RULE,
  ].filter(Boolean);
  const core = parts.join("\n\n");
  const trends = trendsContextBlock?.trim()
    ? `\n\n${trendsContextBlock.trim()}`
    : "";
  const workContext = workContextBlock?.trim()
    ? `\n\n${workContextBlock.trim()}`
    : "";
  return `${core}${trends}${workContext}\n\n${JSON_SHAPE}`;
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

  const tags = Array.isArray(input.tags)
    ? input.tags
        .map((t) => String(t ?? "").trim().replace(/^#+/, "").trim())
        .filter(Boolean)
        .slice(0, 12)
    : [];
  const persona =
    tags.length > 0
      ? `작품 태그(페르소나): 이 작품은 ${tags.map((t) => `#${t}`).join(" ")} 성격을 가진 작품이다.\n\n`
      : "";

  const epLine =
    typeof input.episode_number === "number" && Number.isFinite(input.episode_number)
      ? `분석 대상 회차: ${input.episode_number}화 (시스템 프롬프트의 연재 구간별 기준 적용 시 이 번호를 사용하라).\n\n`
      : "";

  return `${lore}${persona}${prevBlock}${continuityHint}${epLine}장르: ${input.genre}

다음 원고를 분석해 JSON으로만 답하세요.

--- 원고 시작 ---
${excerpt}
--- 원고 끝 ---`;
}
