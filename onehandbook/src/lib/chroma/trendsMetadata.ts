/**
 * RAG 트렌드 파일 메타데이터 — Chroma 필터·정렬용 (문자열 스칼라만).
 */

export const TRENDS_GENRE_ALL = "전체";

/** works.genre·필터·저장 시 동일 규칙으로 맞춤 */
export function normalizeTrendsGenre(raw: string): string {
  const s = raw.trim().replace(/\s+/g, " ");
  return s || TRENDS_GENRE_ALL;
}

export type ParsedTrendsFile = {
  body: string;
  genre: string;
  /** YYYY-MM-DD */
  date: string;
  /**
   * 프론트매터 `source` — 리포트·RAG 출처로 작가에게 보여 줄 한 줄(미입력 시 파일 경로 사용).
   */
  citation_source?: string;
};

/**
 * 선택적 YAML 프론트매터(--- ... ---) 파싱. 없으면 본문 전체 사용.
 * 키: genre, date, source(선택·출처 표기)
 */
export function parseTrendsFileContent(
  raw: string,
  fallbackDateYmd: string
): ParsedTrendsFile {
  const trimmed = raw.replace(/^\uFEFF/, "").trimStart();
  const fm = trimmed.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!fm) {
    return {
      body: trimmed.trim(),
      genre: TRENDS_GENRE_ALL,
      date: fallbackDateYmd,
    };
  }

  const header = fm[1]!;
  const body = fm[2]!.trim();
  const map: Record<string, string> = {};
  for (const line of header.split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const k = line.slice(0, idx).trim().toLowerCase();
    let v = line.slice(idx + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    map[k] = v;
  }

  const genre = normalizeTrendsGenre(map.genre ?? map.genres ?? TRENDS_GENRE_ALL);
  const dateRaw = (map.date ?? map.published ?? "").trim();
  const date = normalizeTrendsDateYmd(dateRaw, fallbackDateYmd);
  const srcLine = (map.source ?? map.citation ?? map.origin ?? "").trim();

  return {
    body,
    genre,
    date,
    ...(srcLine ? { citation_source: srcLine } : {}),
  };
}

/** YYYY-MM-DD 정규화; 잘못된 값이면 fallback */
export function normalizeTrendsDateYmd(
  raw: string,
  fallbackYmd: string
): string {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = Date.parse(s);
  if (!Number.isNaN(d)) return new Date(d).toISOString().slice(0, 10);
  return fallbackYmd;
}

/** 메타데이터 date 문자열 → 정렬용 타임스탬프 */
export function trendsDateToMillis(meta: Record<string, unknown>): number {
  const d = meta.date;
  if (typeof d !== "string" || !d.trim()) return 0;
  const ymd = normalizeTrendsDateYmd(d, "1970-01-01");
  const t = Date.parse(ymd);
  return Number.isNaN(t) ? 0 : t;
}
