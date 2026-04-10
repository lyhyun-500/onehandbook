import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import type { SupabaseClient } from "@supabase/supabase-js";

/** 모바일 무료 베스트 기본 URL */
export const DEFAULT_MUNPIA_BEST_MOBILE_URL =
  "https://m.munpia.com/genres/best/novels";

export type MunpiaBestItem = {
  rank: number;
  title: string;
  detailUrl: string;
  novelKey: string;
};

export type MunpiaBestSnapshot = {
  savedAt: string;
  dateYmd: string;
  sourceUrl: string;
  items: MunpiaBestItem[];
};

export type MunpiaReaderPlannedWork = MunpiaBestItem & {
  isRisingStar: boolean;
  risingReason: "rank_jump_10" | "new_in_top20" | null;
};

export function getYmdInTimeZone(d: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!y || !m || !day) return d.toISOString().slice(0, 10);
  return `${y}-${m}-${day}`;
}

export function snapshotPathForYmd(rootCwd: string, ymd: string): string {
  return join(
    rootCwd,
    "data",
    "trends",
    "munpia-snapshots",
    `best-${ymd}.json`
  );
}

export async function loadMunpiaBestSnapshot(
  rootCwd: string,
  ymd: string
): Promise<MunpiaBestSnapshot | null> {
  const p = snapshotPathForYmd(rootCwd, ymd);
  try {
    const raw = await readFile(p, "utf8");
    return JSON.parse(raw) as MunpiaBestSnapshot;
  } catch {
    return null;
  }
}

export async function saveMunpiaBestSnapshot(
  snap: MunpiaBestSnapshot,
  rootCwd: string
): Promise<string> {
  const p = snapshotPathForYmd(rootCwd, snap.dateYmd);
  await mkdir(join(rootCwd, "data", "trends", "munpia-snapshots"), {
    recursive: true,
  });
  await writeFile(p, JSON.stringify(snap, null, 2), "utf8");
  return p;
}

/**
 * tsx evaluate 주입 이슈 회피 — 문자열 IIFE 만 사용
 */
export function buildMunpiaBestListExtractorExpression(): string {
  return `(() => {
    var items = [];
    var anchors = document.querySelectorAll('a[href*="/novel/detail/"]');
    for (var i = 0; i < anchors.length; i++) {
      var a = anchors[i];
      var href = a.getAttribute("href") || "";
      var m = href.match(/\\/novel\\/detail\\/(\\d+)/);
      if (!m) continue;
      var id = m[1];
      var rankEl = a.querySelector(".rank");
      var titleEl = a.querySelector(".title");
      if (!rankEl || !titleEl) continue;
      var rm = (rankEl.textContent || "").match(/(\\d+)/);
      if (!rm) continue;
      var rank = parseInt(rm[1], 10);
      var title = (titleEl.innerText || "").replace(/\\s+/g, " ").trim();
      title = title.replace(/^NEW\\s*/i, "").trim();
      var detailUrl = href.indexOf("http") === 0 ? href : "https://m.munpia.com" + href;
      items.push({ rank: rank, title: title, detailUrl: detailUrl, novelKey: id });
    }
    items.sort(function (a, b) { return a.rank - b.rank; });
    var seen = {};
    var out = [];
    for (var j = 0; j < items.length; j++) {
      var it = items[j];
      if (seen[it.novelKey]) continue;
      seen[it.novelKey] = true;
      out.push(it);
    }
    out.sort(function (a, b) { return a.rank - b.rank; });
    return out;
  })()`;
}

function rankByNovelKey(
  snap: MunpiaBestSnapshot | null
): Map<string, number> {
  const m = new Map<string, number>();
  if (!snap?.items) return m;
  for (const it of snap.items) {
    m.set(it.novelKey, it.rank);
  }
  return m;
}

/**
 * 어제 스냅샷 대비 급상승(10계단↑) 또는 베스트 20 신규 진입 → isRisingStar
 * 오늘 후보: 베스트 1~20 미분석 + rising(1~40) 미분석, 최대 maxWorks건
 */
export function planMunpiaReaderTargets(
  todayItems: MunpiaBestItem[],
  yesterdaySnap: MunpiaBestSnapshot | null,
  ingestedNovelKeys: Set<string>,
  maxWorks: number
): MunpiaReaderPlannedWork[] {
  const prevRank = rankByNovelKey(yesterdaySnap);
  const prevTop20Keys =
    yesterdaySnap == null
      ? null
      : new Set(
          yesterdaySnap.items
            .filter((x) => x.rank <= 20)
            .map((x) => x.novelKey)
        );

  const annotated: MunpiaReaderPlannedWork[] = [];
  for (const it of todayItems) {
    if (it.rank > 40) continue;
    const pr = prevRank.get(it.novelKey);
    let isRising = false;
    let risingReason: MunpiaReaderPlannedWork["risingReason"] = null;

    const newInTop20 =
      it.rank <= 20 &&
      prevTop20Keys != null &&
      !prevTop20Keys.has(it.novelKey);
    const jump10 = pr !== undefined && pr - it.rank >= 10;

    if (newInTop20) {
      isRising = true;
      risingReason = "new_in_top20";
    } else if (jump10) {
      isRising = true;
      risingReason = "rank_jump_10";
    }

    annotated.push({ ...it, isRisingStar: isRising, risingReason });
  }

  const risingPool = annotated.filter(
    (w) =>
      w.isRisingStar &&
      !ingestedNovelKeys.has(w.novelKey) &&
      w.rank <= 40
  );
  risingPool.sort((a, b) => a.rank - b.rank);

  const basePool = annotated.filter(
    (w) =>
      w.rank <= 20 &&
      !ingestedNovelKeys.has(w.novelKey) &&
      !w.isRisingStar
  );
  basePool.sort((a, b) => a.rank - b.rank);

  const seen = new Set<string>();
  const out: MunpiaReaderPlannedWork[] = [];
  for (const w of risingPool) {
    if (seen.has(w.novelKey)) continue;
    seen.add(w.novelKey);
    out.push(w);
    if (out.length >= maxWorks) return out;
  }
  for (const w of basePool) {
    if (seen.has(w.novelKey)) continue;
    seen.add(w.novelKey);
    out.push(w);
    if (out.length >= maxWorks) return out;
  }
  return out;
}

const PAGE = 400;

export async function fetchMunpiaReaderIngestedNovelKeys(
  supabase: SupabaseClient
): Promise<Set<string>> {
  const keys = new Set<string>();
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("trends")
      .select("extra")
      .eq("platform", "문피아-독자뷰요약")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`trends 조회 실패: ${error.message}`);
    if (!data?.length) break;
    for (const row of data) {
      const ex = row.extra as Record<string, unknown> | null;
      const k = ex?.munpia_novel_key;
      if (typeof k === "string" && k.trim()) keys.add(k.trim());
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return keys;
}

export function extractNovelKeyFromMunpiaUrl(u: string): string | null {
  const m =
    u.match(/novel\.munpia\.com\/(\d+)(?:\/|$)/i) ||
    u.match(/munpia\.com\/novel\/detail\/(\d+)/i);
  return m ? m[1] : null;
}

export function buildNovelTocUrl(novelKey: string): string {
  return `https://novel.munpia.com/${novelKey}`;
}

export function buildTocMaxPageExtractorExpression(novelKey: string): string {
  if (!/^\d+$/.test(novelKey)) {
    throw new Error("novelKey must be numeric");
  }
  return `(() => {
    var novelKey = "${novelKey}";
    var re = new RegExp("^/" + novelKey + "/page/(\\\\d+)(?:/|$)");
    var max = 1;
    var anchors = document.querySelectorAll("a[href]");
    for (var i = 0; i < anchors.length; i++) {
      var h = anchors[i].getAttribute("href") || "";
      var m = h.match(re);
      if (!m) continue;
      var n = parseInt(m[1], 10);
      if (isFinite(n) && n > max) max = n;
    }
    return max;
  })()`;
}

/**
 * 목차 페이지에서 neSrl 회차 링크를 DOM 순서대로 수집합니다.
 * (최하단 회차를 고르려면 호출 측에서 배열의 뒤쪽을 사용)
 */
export function buildNeSrlEpisodeCollectorOrderedExpression(
  novelKey: string
): string {
  if (!/^\d+$/.test(novelKey)) {
    throw new Error("novelKey must be numeric");
  }
  return `(() => {
    var novelKey = "${novelKey}";
    var base = "https://novel.munpia.com";
    var needle = "/" + novelKey + "/page/";
    var seen = new Set();
    var out = [];
    var anchors = document.querySelectorAll("a[href]");
    for (var i = 0; i < anchors.length; i++) {
      var h = anchors[i].getAttribute("href") || "";
      if (h.indexOf(needle) < 0 || h.indexOf("/neSrl/") < 0) continue;
      if (h.indexOf("nvView/viewComment") >= 0) continue;
      var path = h.split("?")[0];
      var abs = path.indexOf("http") === 0 ? path : base + path;
      if (seen.has(abs)) continue;
      seen.add(abs);
      out.push(abs);
    }
    return out;
  })()`;
}

/**
 * 특정 회차 번호(예: [1,2,3,4,5])에 해당하는 뷰어 URL만 뽑는다.
 * (목차는 최신순이 많아 마지막 페이지부터 탐색하는 호출 방식과 함께 사용)
 */
export function buildEpisodeNumberCollectorExpression(
  novelKey: string,
  targetEpisodeNos: number[]
): string {
  if (!/^\d+$/.test(novelKey)) {
    throw new Error("novelKey must be numeric");
  }
  const targets = targetEpisodeNos
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 9999)
    .slice(0, 20);
  return `(() => {
    var novelKey = "${novelKey}";
    var base = "https://novel.munpia.com";
    var targets = ${JSON.stringify(targets)};
    var want = {};
    for (var i = 0; i < targets.length; i++) want[String(targets[i])] = true;
    var out = {};
    var needle = "/" + novelKey + "/page/";
    var anchors = document.querySelectorAll("a[href]");
    for (var j = 0; j < anchors.length; j++) {
      var a = anchors[j];
      var h = a.getAttribute("href") || "";
      if (h.indexOf(needle) < 0 || h.indexOf("/neSrl/") < 0) continue;
      if (h.indexOf("nvView/viewComment") >= 0) continue;
      var txt = (a.textContent || "").replace(/\\s+/g, " ").trim();
      var m = txt.match(/^(\\d+)\\s*화\\b/);
      if (!m) continue;
      var ep = m[1];
      if (!want[ep]) continue;
      if (out[ep]) continue;
      var path = h.split("?")[0];
      out[ep] = path.indexOf("http") === 0 ? path : base + path;
    }
    return out;
  })()`;
}

/**
 * novel.munpia.com/{id} 목차에서 neSrl 뷰어 링크 상위 n개 (본문 페이지)
 */
export function buildNeSrlEpisodeCollectorExpression(
  novelKey: string
): string {
  if (!/^\d+$/.test(novelKey)) {
    throw new Error("novelKey must be numeric");
  }
  return `(() => {
    var novelKey = "${novelKey}";
    var base = "https://novel.munpia.com";
    var needle = "/" + novelKey + "/page/";
    var seen = new Set();
    var out = [];
    var anchors = document.querySelectorAll("a[href]");
    for (var i = 0; i < anchors.length; i++) {
      var h = anchors[i].getAttribute("href") || "";
      if (h.indexOf(needle) < 0 || h.indexOf("/neSrl/") < 0) continue;
      if (h.indexOf("nvView/viewComment") >= 0) continue;
      var parts = h.split("/neSrl/");
      if (parts.length < 2) continue;
      var idPart = parts[1].split("?")[0].split("/")[0];
      if (!/^\\d+$/.test(idPart)) continue;
      if (seen.has(idPart)) continue;
      seen.add(idPart);
      var path = h.split("?")[0];
      var abs = path.indexOf("http") === 0 ? path : base + path;
      out.push(abs);
      if (out.length >= 6) break;
    }
    return out.slice(0, 5);
  })()`;
}
