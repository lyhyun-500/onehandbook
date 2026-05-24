// 선택적 UPDATE — 의제 신규-1+2 단계 C-4 (commit 3) 정합.
//
// LEE 결정 영속화:
// - 결정 12 (옵션 IN-1): NULL column 만 UPDATE (사용자 입력 보존)
// - 결정 9 (옵션 LS-2): worldview_source / characters_source 항목 분리
//
// works.world_setting / character_settings = JSONB (migration 영속화 정합).
// 추출 진행 시 = 추출 항목별 worldview_source / characters_source = 'auto_extracted' UPDATE.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { LoreExtractionResult } from "./extractLore";
import type { LoreNullCase } from "@/lib/works/loreCheck";

export interface ApplyLoreExtractionInput {
  workId: number;
  loreCase: LoreNullCase;
  extracted: LoreExtractionResult;
}

export async function applyLoreExtraction(
  supabase: SupabaseClient,
  input: ApplyLoreExtractionInput,
): Promise<void> {
  const updateData: Record<string, unknown> = {};

  // 세계관 UPDATE (worldview_only_null 또는 both_null)
  if (
    (input.loreCase === "worldview_only_null" || input.loreCase === "both_null") &&
    input.extracted.worldview
  ) {
    updateData.world_setting = input.extracted.worldview;
    updateData.worldview_source = "auto_extracted";
  }

  // 인물 UPDATE (characters_only_null 또는 both_null)
  if (
    (input.loreCase === "characters_only_null" || input.loreCase === "both_null") &&
    input.extracted.characters
  ) {
    updateData.character_settings = input.extracted.characters;
    updateData.characters_source = "auto_extracted";
  }

  if (Object.keys(updateData).length === 0) return;

  const { error } = await supabase
    .from("works")
    .update(updateData)
    .eq("id", input.workId);

  if (error) {
    throw new Error(`작품 lore UPDATE 실패: ${error.message}`);
  }
}
