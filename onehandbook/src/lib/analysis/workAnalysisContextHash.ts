import { md5Hex } from "@/lib/contentHash";
import {
  normalizeCharacterSettings,
  normalizeWorldSetting,
} from "@/lib/works/loreTypes";

export type WorkRowForAnalysisContext = {
  genre: string | null | undefined;
  title: string | null | undefined;
  world_setting: unknown;
  character_settings: unknown;
};

/**
 * 회차 분석 프롬프트에 들어가는 작품 맥락(장르·제목·로어)이 바뀌면 해시가 달라져
 * analysis_results 캐시·CONTENT_UNCHANGED 판정이 무효화됩니다.
 */
export function computeWorkAnalysisContextHash(
  work: WorkRowForAnalysisContext,
  includeLore: boolean
): string {
  const genre = (work.genre ?? "").trim();
  const title = (work.title ?? "").trim();
  if (!includeLore) {
    return md5Hex(
      JSON.stringify({ v: 1, genre, title, includeLore: false })
    );
  }
  const w = normalizeWorldSetting(work.world_setting);
  const world = {
    background: w.background,
    era: w.era,
    rules: w.rules,
  };
  const characters = normalizeCharacterSettings(work.character_settings)
    .filter((c) => c.name.trim())
    .map((c) => ({
      name: c.name.trim(),
      role: c.role,
      personality: c.personality,
      abilities: c.abilities,
      goals: c.goals,
      relationships: c.relationships,
    }));
  return md5Hex(
    JSON.stringify({
      v: 1,
      genre,
      title,
      includeLore: true,
      world,
      characters,
    })
  );
}

/**
 * `analysis_results.work_context_hash`가 없으면(마이그레이션 전·NULL) 원고만으로
 * CONTENT_UNCHANGED·통합 프리체크 "변경 없음"을 허용한다.
 * 값이 있으면 현재 작품 맥락 해시와 같을 때만 미변경으로 본다.
 */
export function workContextAllowsContentUnchanged(
  storedWorkContextHash: string | null | undefined,
  currentWorkContextHash: string
): boolean {
  if (storedWorkContextHash == null || storedWorkContextHash.trim() === "") {
    return true;
  }
  return storedWorkContextHash === currentWorkContextHash;
}
