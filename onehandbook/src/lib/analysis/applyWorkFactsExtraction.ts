/**
 * applyWorkFactsExtraction — 5단계 서버 영속화 (ADR-0029 정합).
 *
 * 단계 순서 사양:
 *   ① new_entities insert (source='extracted', first_seen_episode=N)
 *   ② ref → 실 entity ID 매핑
 *   ③ matched 신규 mention = aliases 누적 (유일 매칭 한정, 모호 X)
 *   ④ (work_id, episode_id) fact 전량 delete   ←┐
 *   ⑤ confidence>=0.5 fact 일괄 insert         ←┘ 인접 (사이 호출 없음)
 *
 * ⑤ 실패 = console.error (best-effort, 분석 결과 영향 0).
 * 트랜잭션 = 앱 레이어 best-effort. 재분석 시 ④+⑤ 하드 교체로 자가 치유.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  EntityCandidate,
  EntityRegistryRow,
} from "./resolveEntityCandidates";
import type {
  ExtractedFact,
  ExtractedNewEntity,
  WorkFactsExtractionResult,
} from "./extractWorkFacts";

export interface ApplyContext {
  workId: number;
  episodeId: number;
  episodeNumber: number;
  episodeContentHash: string;
  sourceJobId: string | null;
}

const MIN_CONFIDENCE = 0.5;

/** "ent_existing_123" → 123. 그 외 = null (= 신규 ref). */
function parseExistingRef(ref: string): number | null {
  const m = ref.match(/^ent_existing_(\d+)$/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** 5단계 영속화 본체. */
export async function applyWorkFactsExtraction(
  sb: SupabaseClient,
  ctx: ApplyContext,
  registry: EntityRegistryRow[],
  candidates: EntityCandidate[],
  extraction: WorkFactsExtractionResult,
): Promise<void> {
  // ─── ① new_entities insert ───────────────────────────────
  const refToId = new Map<string, number>();
  for (const ent of extraction.new_entities as ExtractedNewEntity[]) {
    const { data, error } = await sb
      .from("work_entities")
      .insert({
        work_id: ctx.workId,
        entity_type: ent.entity_type,
        canonical_name: ent.canonical_name,
        aliases: [],
        brief: ent.brief,
        attributes: {},
        source: "extracted",
        first_seen_episode: ctx.episodeNumber,
      })
      .select("id")
      .single();

    if (error) {
      // UNIQUE 충돌 (23505) = 동일 canonical 기존 entity 존재 → SELECT 로 ID 회수
      if (error.code === "23505") {
        const { data: existing } = await sb
          .from("work_entities")
          .select("id")
          .eq("work_id", ctx.workId)
          .eq("entity_type", ent.entity_type)
          .eq("canonical_name", ent.canonical_name)
          .maybeSingle();
        if (existing?.id) {
          refToId.set(ent.ref, existing.id as number);
          continue;
        }
      }
      console.warn(
        `[work-bible] step1 new_entity insert 실패 (ref=${ent.ref}):`,
        error.message,
      );
      continue;
    }
    if (data?.id) refToId.set(ent.ref, data.id as number);
  }

  // ─── ② ref → 실 ID 매핑 헬퍼 (existing + new 통합) ─────────
  const resolveRef = (ref: string): number | null => {
    const existing = parseExistingRef(ref);
    if (existing != null) return existing;
    return refToId.get(ref) ?? null;
  };

  // ─── ③ aliases 누적 (유일 매칭만, 모호 보류) ───────────────
  const aliasAdditions = new Map<number, Set<string>>();
  for (const cand of candidates) {
    if (cand.matches.length !== 1) continue;
    const r = cand.matches[0];
    const existingNames = new Set([
      r.canonical_name.trim(),
      ...(r.aliases ?? []).map((a) => a.trim()),
    ]);
    if (existingNames.has(cand.mention)) continue;
    if (!aliasAdditions.has(r.id)) aliasAdditions.set(r.id, new Set());
    aliasAdditions.get(r.id)!.add(cand.mention);
  }

  for (const [entityId, additions] of aliasAdditions.entries()) {
    const registryRow = registry.find((r) => r.id === entityId);
    if (!registryRow) continue;
    const merged = Array.from(
      new Set([...(registryRow.aliases ?? []), ...additions]),
    );
    const { error } = await sb
      .from("work_entities")
      .update({ aliases: merged, updated_at: new Date().toISOString() })
      .eq("id", entityId);
    if (error) {
      console.warn(
        `[work-bible] step3 aliases 갱신 실패 (entity_id=${entityId}):`,
        error.message,
      );
    }
  }

  // ─── ④+⑤ 인접: fact delete → insert (사이 호출 없음) ─────
  const factRows = (extraction.facts as ExtractedFact[])
    .filter((f) => f.confidence >= MIN_CONFIDENCE)
    .map((f) => {
      const entityIds = f.entity_refs
        .map(resolveRef)
        .filter((n): n is number => typeof n === "number");
      if (entityIds.length === 0) return null;
      return {
        work_id: ctx.workId,
        episode_id: ctx.episodeId,
        episode_number: ctx.episodeNumber,
        fact_type: f.fact_type,
        entity_ids: entityIds,
        content: f.content,
        value: f.value,
        confidence: f.confidence,
        source_job_id: ctx.sourceJobId,
        episode_content_hash: ctx.episodeContentHash,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  // ④ delete
  const { error: delErr } = await sb
    .from("work_facts")
    .delete()
    .eq("work_id", ctx.workId)
    .eq("episode_id", ctx.episodeId);
  if (delErr) {
    console.error(
      `[work-bible] step4 fact delete 실패 (work_id=${ctx.workId}, episode_id=${ctx.episodeId}):`,
      delErr.message,
    );
    return;
  }

  // ⑤ insert (delete 직후 인접)
  if (factRows.length === 0) return;
  const { error: insErr } = await sb.from("work_facts").insert(factRows);
  if (insErr) {
    console.error(
      `[work-bible] step5 fact insert 실패 (work_id=${ctx.workId}, episode_id=${ctx.episodeId}, rows=${factRows.length}):`,
      insErr.message,
    );
  }
}
