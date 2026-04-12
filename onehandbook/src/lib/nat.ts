import { ANALYSIS_PROFILES } from "@/config/analysis-profiles";
import { HOLISTIC_CLIENT_CHUNK_SIZE } from "@/lib/analysis/holisticEpisodeChunks";

/** 플랫폼 비특화 범용 분석 (NAT 옵션 미포함 시 사용) — Claude + generic 프롬프트 */
export const NAT_GENERIC_AGENT_ID = "generic";

export type NatAnalysisOptions = {
  includeLore: boolean;
  includePlatformOptimization: boolean;
};

/** 원고 글자 수 — 유니코드 확장 문자(이모지 등)는 1자로 칩니다. */
export function countManuscriptChars(text: string): number {
  return [...text].length;
}

/** 본문 길이 구간별 기본 NAT (옵션 가산 전) */
export function natBaseCostByLength(charCount: number): number {
  const n = Math.max(0, charCount);
  if (n <= 3000) return 1;
  if (n <= 6000) return 2;
  if (n <= 10000) return 3;
  return 3;
}

export function natLengthTierLabel(charCount: number): string {
  const n = Math.max(0, charCount);
  if (n <= 3000) return "3,000자 이하";
  if (n <= 6000) return "3,001~6,000자";
  if (n <= 10000) return "6,001~10,000자";
  return "10,000자 초과 (상한 구간)";
}

export function computeNatCost(
  charCount: number,
  opts: NatAnalysisOptions
): number {
  let total = natBaseCostByLength(charCount);
  if (opts.includeLore) total += 1;
  if (opts.includePlatformOptimization) total += 1;
  return total;
}

export type NatBreakdownLine = { label: string; nat: number };

export function buildNatBreakdown(
  charCount: number,
  opts: NatAnalysisOptions
): { lines: NatBreakdownLine[]; total: number } {
  const base = natBaseCostByLength(charCount);
  const lines: NatBreakdownLine[] = [
    { label: `기본 (${natLengthTierLabel(charCount)})`, nat: base },
  ];
  if (opts.includeLore) {
    lines.push({ label: "세계관·인물 설정 포함", nat: 1 });
  }
  if (opts.includePlatformOptimization) {
    lines.push({ label: "플랫폼 최적화 분석 포함", nat: 1 });
  }
  const total = lines.reduce((s, l) => s + l.nat, 0);
  return { lines, total };
}

/** API·LLM에 사용할 프로필 id */
export function resolveAnalysisAgentVersion(
  includePlatformOptimization: boolean,
  selectedAgentVersion: string
): string {
  if (!includePlatformOptimization) {
    return NAT_GENERIC_AGENT_ID;
  }
  return selectedAgentVersion;
}

export function isKnownAnalysisProfileId(id: string): boolean {
  return ANALYSIS_PROFILES.some((p) => p.id === id);
}

/** 일괄 분석: 선택된 회차마다 동일 옵션 적용 시 총 NAT */
export function buildBatchNatBreakdown(
  episodes: { id: number; charCount: number }[],
  selectedIds: number[],
  opts: NatAnalysisOptions
): { lines: NatBreakdownLine[]; total: number; episodeCount: number } {
  const selected = episodes.filter((e) => selectedIds.includes(e.id));
  const episodeCount = selected.length;
  let totalBase = 0;
  for (const e of selected) {
    totalBase += natBaseCostByLength(e.charCount);
  }
  const lines: NatBreakdownLine[] = [
    {
      label:
        episodeCount > 0
          ? `기본 (${episodeCount}개 회차, 글자 수 구간 합)`
          : "기본",
      nat: totalBase,
    },
  ];
  let total = totalBase;
  if (opts.includeLore && episodeCount > 0) {
    const add = episodeCount;
    lines.push({
      label: `세계관·인물 설정 포함 (회차당 1 NAT × ${episodeCount})`,
      nat: add,
    });
    total += add;
  }
  if (opts.includePlatformOptimization && episodeCount > 0) {
    const add = episodeCount;
    lines.push({
      label: `플랫폼 최적화 (회차당 1 NAT × ${episodeCount})`,
      nat: add,
    });
    total += add;
  }
  return { lines, total, episodeCount };
}

/**
 * 통합 일괄 분석 1회(선택 회차 한 번에 묶음): **회차당 1 NAT** + 로어·플랫폼 각 통합 1회 가산.
 * (단일 회차·통합 모두 글자 구간이 아닌 회차 수 기준)
 */
export function computeHolisticNatCost(
  episodeCount: number,
  opts: NatAnalysisOptions
): number {
  let total = Math.max(0, episodeCount);
  if (opts.includeLore) total += 1;
  if (opts.includePlatformOptimization) total += 1;
  return total;
}

/**
 * 다청크 통합(10화 초과): 각 청크 기본 = **해당 청크 회차 수만큼 1 NAT/회차**,
 * 로어·플랫폼은 **전체 작업당 1회**로 첫 청크에만 가산.
 */
export function computeHolisticChunkNatCost(
  episodeCountInChunk: number,
  chunkIndexZeroBased: number,
  opts: NatAnalysisOptions
): number {
  let total = Math.max(0, episodeCountInChunk);
  if (chunkIndexZeroBased === 0) {
    if (opts.includeLore) total += 1;
    if (opts.includePlatformOptimization) total += 1;
  }
  return total;
}

export function buildHolisticNatBreakdown(
  totalCombinedChars: number,
  episodeCount: number,
  opts: NatAnalysisOptions
): { lines: NatBreakdownLine[]; total: number } {
  const base = Math.max(0, episodeCount);
  const lines: NatBreakdownLine[] = [
    {
      label:
        episodeCount > 0
          ? `기본 (회차당 1 NAT × ${episodeCount}화 · 합산 원고 ${natLengthTierLabel(totalCombinedChars)})`
          : `기본 (${natLengthTierLabel(totalCombinedChars)})`,
      nat: base,
    },
  ];
  if (opts.includeLore) {
    lines.push({ label: "세계관·인물 설정 포함 (통합 1회)", nat: 1 });
  }
  if (opts.includePlatformOptimization) {
    lines.push({ label: "플랫폼 최적화 분석 포함 (통합 1회)", nat: 1 });
  }
  const total = lines.reduce((s, l) => s + l.nat, 0);
  return { lines, total };
}

/** 배치 병합(분석 JSON만으로 최종 통합 리포트) */
export function computeHolisticMergeNatCost(): number {
  return 2;
}

/** 10화 단위 배치 + 병합 예상 NAT (선택 회차 전체) */
export function estimateHolisticBatchTotalNat(
  episodes: { id: number; charCount: number }[],
  orderedEpisodeIds: number[],
  opts: NatAnalysisOptions
): {
  chunkCount: number;
  batchNat: number;
  mergeNat: number;
  total: number;
} {
  const chunkSize = HOLISTIC_CLIENT_CHUNK_SIZE;
  const ids = orderedEpisodeIds;
  const chunkCount = Math.ceil(ids.length / chunkSize) || 0;
  let batchNat = 0;
  let chunkIdx = 0;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const slice = ids.slice(i, i + chunkSize);
    batchNat += computeHolisticChunkNatCost(slice.length, chunkIdx, opts);
    chunkIdx += 1;
  }
  const mergeNat = chunkCount > 1 ? computeHolisticMergeNatCost() : 0;
  return {
    chunkCount,
    batchNat,
    mergeNat,
    total: batchNat + mergeNat,
  };
}
