import { ANALYSIS_PROFILES } from "@/config/analysis-profiles";
import { HOLISTIC_CLIENT_CHUNK_SIZE } from "@/lib/analysis/holisticEpisodeChunks";

/** 플랫폼 비특화 범용 분석 (NAT 옵션 미포함 시 사용) — Claude + generic 프롬프트 */
export const NAT_GENERIC_AGENT_ID = "generic";

// 의제 신규-1+2 정합: 세계관·인물 = 기본 포함 (옵션 폐기).
// 결정 1 (옵션 A-1): includeLore 옵션 폐기 + 가산 코드 제거.
// 결정 8/13/14 (분기 γ-1 + H-2-γ): workAnalysisContextHash 시그니처 보존,
// 호출처에서 true 고정 (별 라운드, 본 파일과 분리).
export type NatAnalysisOptions = {
  includePlatformOptimization: boolean;
};

/** 원고 글자 수 — 유니코드 확장 문자(이모지 등)는 1자로 칩니다. */
export function countManuscriptChars(text: string): number {
  return [...text].length;
}

/** 본문 길이 구간별 기본 NAT (옵션 가산 전) */
export function natBaseCostByLength(charCount: number): number {
  const n = Math.max(0, charCount);
  if (n <= 6000) return 1;
  return 2;
}

export function natLengthTierLabel(charCount: number): string {
  const n = Math.max(0, charCount);
  if (n <= 6000) return "6,000자 이하";
  return "6,001~10,000자";
}

/** ADR-0031: 프롤로그 NAT 사양 — 3천자 미만 = 0, 이상 = 1. */
export function prologueNatCost(charCount: number): number {
  return charCount < 3000 ? 0 : 1;
}

export function computeNatCost(
  charCount: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  opts: NatAnalysisOptions,
  episodeType?: "episode" | "prologue",
): number {
  if (episodeType === "prologue") {
    return prologueNatCost(charCount);
  }
  return natBaseCostByLength(charCount);
}

export type NatBreakdownLine = { label: string; nat: number };

export function buildNatBreakdown(
  charCount: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  opts: NatAnalysisOptions,
  episodeType?: "episode" | "prologue",
): { lines: NatBreakdownLine[]; total: number } {
  if (episodeType === "prologue") {
    const base = prologueNatCost(charCount);
    const label =
      charCount < 3000
        ? "프롤로그 (3,000자 미만 · 무료)"
        : "프롤로그 (3,000자 이상)";
    const lines: NatBreakdownLine[] = [{ label, nat: base }];
    return { lines, total: base };
  }
  const base = natBaseCostByLength(charCount);
  const lines: NatBreakdownLine[] = [
    { label: `기본 (${natLengthTierLabel(charCount)})`, nat: base },
  ];
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

/**
 * @deprecated 호출처 0건. Inngest 마이그레이션 클린업 때 batch 잔재와 함께 삭제 예정.
 * 일괄 분석: 선택된 회차마다 동일 옵션 적용 시 총 NAT
 */
export function buildBatchNatBreakdown(
  episodes: { id: number; charCount: number }[],
  selectedIds: number[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  const total = totalBase;
  return { lines, total, episodeCount };
}

/** ADR-0031: 회차 단위 일괄 NAT — 본편 = 1, 프롤로그 = prologueNatCost(charCount). */
export type HolisticEpisodeNatInput = {
  charCount: number;
  episode_type?: "episode" | "prologue";
};

export function holisticEpisodeNat(ep: HolisticEpisodeNatInput): number {
  if (ep.episode_type === "prologue") {
    return prologueNatCost(ep.charCount);
  }
  return 1;
}

/**
 * 통합 일괄 분석 1회(선택 회차 한 번에 묶음): 본편 = 회차당 1 NAT,
 * 프롤로그 (ADR-0031) = 3천 미만 0 / 이상 1.
 */
export function computeHolisticNatCost(
  episodes: HolisticEpisodeNatInput[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  opts: NatAnalysisOptions,
): number {
  let total = 0;
  for (const ep of episodes) total += holisticEpisodeNat(ep);
  return Math.max(0, total);
}

/**
 * 다청크 통합(10화 초과): 각 청크 기본 = 본편 회차당 1 NAT/프롤로그 = 별도 사양.
 * 플랫폼은 **전체 작업당 1회**로 첫 청크에만 가산.
 */
export function computeHolisticChunkNatCost(
  chunkEpisodes: HolisticEpisodeNatInput[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  chunkIndexZeroBased: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  opts: NatAnalysisOptions,
): number {
  let total = 0;
  for (const ep of chunkEpisodes) total += holisticEpisodeNat(ep);
  return Math.max(0, total);
}

export function buildHolisticNatBreakdown(
  episodes: HolisticEpisodeNatInput[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  opts: NatAnalysisOptions,
): { lines: NatBreakdownLine[]; total: number } {
  const regularCount = episodes.filter((e) => e.episode_type !== "prologue").length;
  const prologueEps = episodes.filter((e) => e.episode_type === "prologue");
  const prologueNat = prologueEps.reduce((s, e) => s + prologueNatCost(e.charCount), 0);
  const base = regularCount + prologueNat;
  const lines: NatBreakdownLine[] = [];
  if (regularCount > 0) {
    lines.push({
      label: `기본 (회차당 1 NAT × ${regularCount}화)`,
      nat: regularCount,
    });
  }
  if (prologueEps.length > 0) {
    lines.push({
      label: `프롤로그 ${prologueEps.length}건 (3,000자 미만 무료)`,
      nat: prologueNat,
    });
  }
  if (lines.length === 0) {
    lines.push({ label: "기본", nat: 0 });
  }
  return { lines, total: base };
}

/** 배치 병합(분석 JSON만으로 최종 통합 리포트) */
export function computeHolisticMergeNatCost(): number {
  return 2;
}

/** 10화 단위 배치 + 병합 예상 NAT (선택 회차 전체) */
export function estimateHolisticBatchTotalNat(
  episodes: { id: number; charCount: number; episode_type?: "episode" | "prologue" }[],
  orderedEpisodeIds: number[],
  opts: NatAnalysisOptions,
): {
  chunkCount: number;
  batchNat: number;
  mergeNat: number;
  total: number;
} {
  const chunkSize = HOLISTIC_CLIENT_CHUNK_SIZE;
  const ids = orderedEpisodeIds;
  const epById = new Map(episodes.map((e) => [e.id, e]));
  const chunkCount = Math.ceil(ids.length / chunkSize) || 0;
  let batchNat = 0;
  let chunkIdx = 0;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const slice = ids.slice(i, i + chunkSize);
    const sliceEps: HolisticEpisodeNatInput[] = slice.map((id) => {
      const ep = epById.get(id);
      return {
        charCount: ep?.charCount ?? 0,
        episode_type: ep?.episode_type,
      };
    });
    batchNat += computeHolisticChunkNatCost(sliceEps, chunkIdx, opts);
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
