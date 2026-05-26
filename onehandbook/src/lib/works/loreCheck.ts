// NULL 분기 검증 사양 — 의제 신규-1+2 단계 C-2 (commit 2) 정합.
//
// LEE 결정 영속화:
// - 결정 9 (옵션 N-2): 한쪽이라도 NULL → 모달 진입
// - 결정 19 (옵션 P-1): name 검증 정밀 사양
// - 결정 21 (분기 α): 빈 필드 = NULL 정합
//
// type 사양 = side-panel/types.ts 정합 (works.world_setting / character_settings JSONB
// → server fetch 시 raw JSON → parseWorldSetting / parseCharacterSettings 정합).

import type {
  Character,
  CharacterSettings,
  WorldSetting,
} from "@/components/side-panel/types";

/**
 * 세계관 NULL 분기 검증.
 * NULL 정합: null / undefined / 빈 object / 모든 필드 빈 문자열.
 */
export function isWorldviewEmpty(
  world: WorldSetting | null | undefined,
): boolean {
  if (!world) return true;
  if (typeof world !== "object") return true;
  const background = world.background?.trim() ?? "";
  const era = world.era?.trim() ?? "";
  const rules = world.rules?.trim() ?? "";
  return !background && !era && !rules;
}

/**
 * 인물 NULL 분기 검증 (옵션 P-1 정밀: name 비어있지 않은 캐릭터 1건 이상 = 존재).
 * NULL 정합: null / undefined / 빈 array / name 비어있는 캐릭터만.
 */
export function isCharactersEmpty(
  characters: CharacterSettings | null | undefined,
): boolean {
  if (!characters) return true;
  if (!Array.isArray(characters)) return true;
  if (characters.length === 0) return true;
  return !characters.some((c: Character) => c.name?.trim());
}

/** NULL 분기 4 경우의 수 영속화. */
export type LoreNullCase =
  | "both_null" // 경우 1: 양쪽 NULL
  | "characters_only_null" // 경우 2: 인물만 NULL (세계관 존재)
  | "worldview_only_null" // 경우 3: 세계관만 NULL (인물 존재)
  | "both_present"; // 경우 4: 양쪽 존재 — 모달 분기 X

export function getLoreNullCase(
  world: WorldSetting | null | undefined,
  characters: CharacterSettings | null | undefined,
): LoreNullCase {
  const worldEmpty = isWorldviewEmpty(world);
  const charsEmpty = isCharactersEmpty(characters);
  if (worldEmpty && charsEmpty) return "both_null";
  if (!worldEmpty && charsEmpty) return "characters_only_null";
  if (worldEmpty && !charsEmpty) return "worldview_only_null";
  return "both_present";
}

/** 4 case 안내 텍스트 (모달 본문 + inline 안내 정합). */
export function getLoreNullPromptText(loreCase: LoreNullCase): string | null {
  switch (loreCase) {
    case "both_null":
      return "인물·세계관 정보가 없어 분석 정밀도가 떨어질 수 있습니다.\n에이전트 자동 추출 후 진행하시겠습니까?";
    case "characters_only_null":
      return "인물 정보가 없어 분석 정밀도가 떨어질 수 있습니다.\n에이전트 자동 추출 후 진행하시겠습니까?";
    case "worldview_only_null":
      return "세계관 정보가 없어 분석 정밀도가 떨어질 수 있습니다.\n에이전트 자동 추출 후 진행하시겠습니까?";
    case "both_present":
      return null;
  }
}
