import type { TrendsSearchHit } from "./trendsTypes";

const MAX_BULLETS = 7;
const LEAD_MAX = 160;

function leadLine(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return "";
  const cut = t.slice(0, LEAD_MAX);
  const lastPeriod = cut.lastIndexOf("。");
  const lastDot = cut.lastIndexOf(".");
  const last = Math.max(lastPeriod, lastDot);
  if (last > 40) return cut.slice(0, last + 1).trim();
  return (cut.length < t.length ? `${cut}…` : cut).trim();
}

export type TrendSearchProvenance = {
  /** Chroma where 로 장르 제한했는지 */
  usedGenreFilter: boolean;
  /** 필터 결과 0건이라 전체 코퍼스로 재검색했는지 */
  unfilteredFallback: boolean;
};

/**
 * 벡터 검색 스니펫을 나열하지 않고, 분석 에이전트용 **장르 트렌드 요약 블록**으로 가공합니다.
 */
export function buildGenreTrendSummaryForAgent(
  workGenre: string,
  searchQuery: string,
  hits: TrendsSearchHit[],
  provenance: TrendSearchProvenance
): string | null {
  if (hits.length === 0) return null;

  const g = workGenre.trim() || "미지정";
  const bullets: string[] = [];
  const seen = new Set<string>();

  for (const h of hits) {
    if (bullets.length >= MAX_BULLETS) break;
    const line = leadLine(h.document);
    if (!line) continue;
    const key = line.slice(0, 48);
    if (seen.has(key)) continue;
    seen.add(key);
    bullets.push(line);
  }

  const lines: string[] = [
    `## 현재 「${g}」 장르 트렌드 요약 (RAG)`,
    `검색 쿼리: ${searchQuery}`,
  ];

  if (provenance.usedGenreFilter && provenance.unfilteredFallback) {
    lines.push(
      "※ 요청 장르 전용 코퍼스에서 매칭이 없어 **전체 장르** 코퍼스로 대체 검색한 결과입니다."
    );
  } else if (provenance.usedGenreFilter) {
    lines.push("※ 아래 근거는 **동일 장르 메타데이터**로 필터링된 코퍼스에서 가져왔습니다.");
  }

  lines.push(
    "",
    "### 핵심 포인트 (스니펫 압축)",
    ...bullets.map((b) => `- ${b}`),
    "",
    "### 근거 (날짜·신선도 우선, 출처)",
    ...hits.slice(0, 10).map((h, i) => {
      const src =
        typeof h.metadata.source === "string"
          ? h.metadata.source
          : "unknown";
      const date =
        typeof h.metadata.date === "string" && h.metadata.date.trim()
          ? h.metadata.date.trim()
          : "날짜 미표기";
      const gmeta =
        typeof h.metadata.genre === "string" && h.metadata.genre.trim()
          ? h.metadata.genre.trim()
          : "—";
      const one = leadLine(h.document);
      return `${i + 1}. [${date}] 장르:${gmeta} · ${src} — ${one}`;
    }),
    "",
    "### 필수 출력 규칙 (RAG·트렌드)",
    "**dimensions** 각 항목의 `comment`, **improvement_points** 항목, **comparable_note**(있을 경우), 통합·일괄 분석의 **strengths**·**improvements**·**executive_summary** 등 **독자에게 노출되는 서술형 코멘트 전체 중 최소 1곳 이상**에, 위에 제공된 트렌드 데이터(핵심 포인트·근거 본문)에 **실제로 등장한 구체적 수치**(예: %, 분, 화, 원, 연도, 배수 등) **또는** 그 자료만의 **고유 키워드·짧은 구절**(2자 이상, 트렌드 문장에서 그대로 가져올 것)을 **반드시 한 번 이상 인용**하라. 인용은 따옴표·마크다운 굵게 없이 본문에 자연스럽게 녹인다.",
    "원고 평가 자체는 냉정하게 유지하되, **인용 1회는 생략하지 말 것**. 트렌드와 원고의 직접 연결이 약하면 「시장·독자 트렌드 자료 기준 ○○(인용)은 … 한편 본 원고는 …」처럼 **한 문장 안에서** 트렌드 인용과 원고 평가를 구분해 서술한다.",
    "",
    "원고와 트렌드의 관련성을 **거짓으로 꾸며 내지는 말 것**. 다만 위 인용 의무는 반드시 지킨다.",
  );

  return lines.join("\n");
}
