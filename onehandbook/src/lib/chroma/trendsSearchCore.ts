import { createChromaClient, getTrendsCollection } from "./chromaClient";
import {
  normalizeTrendsGenre,
  trendsDateToMillis,
  TRENDS_GENRE_ALL,
} from "./trendsMetadata";
import { buildGenreTrendSummaryForAgent } from "./trendsContextSummary";
import type { TrendReferenceItem } from "@/lib/ai/types";
import type {
  TrendsSearchExecutionResult,
  TrendsSearchHit,
} from "./trendsTypes";

export const TRENDS_SEARCH_MAX_N = 20;

export type { TrendsSearchExecutionResult, TrendsSearchHit } from "./trendsTypes";

function hitsFromQueryResult(result: {
  documents?: (string | null)[][] | null;
  metadatas?: (Record<string, unknown> | null)[][] | null;
  distances?: (number | null)[][] | null;
}): TrendsSearchHit[] {
  const docs = result.documents?.[0] ?? [];
  const metas = result.metadatas?.[0] ?? [];
  const dists = result.distances?.[0] ?? [];

  return docs.map((document, i) => ({
    document: document ?? "",
    metadata: (metas[i] as Record<string, unknown>) ?? {},
    distance: dists[i] ?? null,
  }));
}

/** 날짜(최신 우선) → 거리(가까울수록 우선) */
export function sortHitsByRecencyAndDistance(hits: TrendsSearchHit[]): void {
  hits.sort((a, b) => {
    const tb = trendsDateToMillis(b.metadata);
    const ta = trendsDateToMillis(a.metadata);
    if (tb !== ta) return tb - ta;
    const da = a.distance ?? Number.POSITIVE_INFINITY;
    const db = b.distance ?? Number.POSITIVE_INFINITY;
    return da - db;
  });
}

/** 분석에 쓰인 RAG 청크의 출처·날짜(중복 제거, 날짜 최신 우선) */
export function extractTrendReferencesFromHits(
  hits: TrendsSearchHit[]
): TrendReferenceItem[] {
  const map = new Map<string, TrendReferenceItem>();
  for (const h of hits) {
    const source =
      typeof h.metadata.source === "string" && h.metadata.source.trim()
        ? h.metadata.source.trim()
        : "내부 트렌드 코퍼스";
    const dr = h.metadata.date;
    const date =
      typeof dr === "string" && dr.trim() ? dr.trim() : "날짜 미표기";
    const key = `${source}\0${date}`;
    if (!map.has(key)) map.set(key, { source, date });
  }
  return Array.from(map.values()).sort((a, b) => {
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    const ad = iso.test(a.date) ? a.date : "";
    const bd = iso.test(b.date) ? b.date : "";
    if (ad && bd && ad !== bd) return bd.localeCompare(ad);
    if (bd && !ad) return 1;
    if (ad && !bd) return -1;
    return a.source.localeCompare(b.source, "ko");
  });
}

export type TrendsContextPack = {
  block: string | null;
  references: TrendReferenceItem[];
};

/**
 * `/api/rag/trends/search` 와 동일한 Chroma 쿼리(인증 제외).
 * `genre` 가 있으면 메타 `genre` 일치만 검색; 0건이면 전체 코퍼스로 한 번 더 검색.
 */
export async function executeTrendsSearch(
  query: string,
  n: number,
  options?: { genre?: string | null }
): Promise<TrendsSearchExecutionResult> {
  const cap = Math.min(TRENDS_SEARCH_MAX_N, Math.max(1, n));
  const genreKey = options?.genre?.trim()
    ? normalizeTrendsGenre(options.genre)
    : null;

  const client = createChromaClient();
  const collection = await getTrendsCollection(client);

  const fetchSize = genreKey && genreKey !== TRENDS_GENRE_ALL
    ? Math.min(TRENDS_SEARCH_MAX_N, Math.max(cap * 4, cap + 16))
    : cap;

  let usedGenreFilter = false;
  let unfilteredFallback = false;

  const runQuery = async (where?: Record<string, string>) => {
    return collection.query({
      queryTexts: [query],
      nResults: fetchSize,
      ...(where ? { where } : {}),
      include: ["documents", "metadatas", "distances"],
    });
  };

  let result;
  if (genreKey && genreKey !== TRENDS_GENRE_ALL) {
    usedGenreFilter = true;
    result = await runQuery({ genre: genreKey });
  } else {
    result = await runQuery();
  }

  let hits = hitsFromQueryResult(result);
  sortHitsByRecencyAndDistance(hits);
  hits = hits.slice(0, cap);

  if (usedGenreFilter && hits.length === 0) {
    unfilteredFallback = true;
    const wide = await runQuery();
    hits = hitsFromQueryResult(wide);
    sortHitsByRecencyAndDistance(hits);
    hits = hits.slice(0, cap);
  }

  return { hits, usedGenreFilter, unfilteredFallback };
}

export function buildTrendsQueryFromWork(genre: string, workTitle: string): string {
  const g = genre.trim() || "미지정";
  const t = workTitle.trim() || "제목 없음";
  return `최신 웹소설 시장·독자 트렌드 및 유통 흐름. 장르: ${g}. 작품 제목: ${t}.`;
}

/** @deprecated 나열형 — 요약은 buildAgentTrendContext 사용 권장 */
export function formatTrendsHitsForSystemPrompt(
  query: string,
  hits: TrendsSearchHit[]
): string | null {
  if (hits.length === 0) return null;

  const blocks = hits.map((h, i) => {
    const src =
      typeof h.metadata.source === "string"
        ? h.metadata.source
        : "unknown";
    const dist =
      h.distance != null && Number.isFinite(h.distance)
        ? ` (유사도 거리: ${h.distance.toFixed(4)})`
        : "";
    return `### 스니펫 ${i + 1} — 출처: ${src}${dist}\n${h.document.trim()}`;
  });

  return [
    "## 최신 웹소설 트렌드 참고 자료 (RAG)",
    `아래 스니펫은 분석 직전 **「${query}」** 로 벡터 검색해 가져온 내용입니다.`,
    "평가·코멘트에 **참고만** 하고, 원고와 무관하면 억지로 연결하지 마세요.",
    "",
    ...blocks,
  ].join("\n");
}

export function buildAgentTrendContext(
  workGenre: string,
  searchQuery: string,
  exec: TrendsSearchExecutionResult
): string | null {
  return buildGenreTrendSummaryForAgent(
    workGenre,
    searchQuery,
    exec.hits,
    {
      usedGenreFilter: exec.usedGenreFilter,
      unfilteredFallback: exec.unfilteredFallback,
    }
  );
}

function loopbackSearchBaseUrl(): string | null {
  const explicit = process.env.TRENDS_RAG_SEARCH_BASE_URL?.trim().replace(/\/$/, "");
  if (explicit) return explicit;
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (site) return site;
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`;
  return null;
}

/**
 * 분석 에이전트용: 가능하면 `/api/rag/trends/search` 로 HTTP 루프백,
 * 설정이 없거나 실패 시 Chroma 직접 호출. 전달 문구는 **장르 트렌드 요약** 형태.
 */
export async function fetchTrendsContextForAnalysis(
  genre: string,
  workTitle: string,
  n: number = 8
): Promise<TrendsContextPack> {
  const empty = (): TrendsContextPack => ({ block: null, references: [] });

  const query = buildTrendsQueryFromWork(genre, workTitle);
  const genreParam = normalizeTrendsGenre(genre);
  const secret = process.env.TRENDS_RAG_API_SECRET?.trim();
  const base = loopbackSearchBaseUrl();

  const packFromExec = (
    exec: TrendsSearchExecutionResult
  ): TrendsContextPack => {
    sortHitsByRecencyAndDistance(exec.hits);
    const refs = extractTrendReferencesFromHits(exec.hits);
    const block = buildAgentTrendContext(genre, query, exec);
    return { block, references: refs };
  };

  if (secret && base) {
    try {
      const res = await fetch(`${base}/api/rag/trends/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({ query, n, genre: genreParam }),
        signal: AbortSignal.timeout(45_000),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          hits?: TrendsSearchHit[];
          usedGenreFilter?: boolean;
          unfilteredFallback?: boolean;
        };
        const hits = Array.isArray(data.hits) ? data.hits : [];
        const exec: TrendsSearchExecutionResult = {
          hits,
          usedGenreFilter: Boolean(data.usedGenreFilter),
          unfilteredFallback: Boolean(data.unfilteredFallback),
        };
        return packFromExec(exec);
      }
      console.warn(
        "[trends RAG] 루프백 API 비정상 응답, Chroma 직접 시도:",
        res.status
      );
    } catch (e) {
      console.warn("[trends RAG] 루프백 API 실패, Chroma 직접 시도:", e);
    }
  }

  try {
    const exec = await executeTrendsSearch(query, n, { genre: genreParam });
    return packFromExec(exec);
  } catch (e) {
    console.warn("[trends RAG] Chroma 직접 검색 실패:", e);
    return empty();
  }
}
