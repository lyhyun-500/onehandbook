/**
 * 시드 이관 스크립트 — works.character_settings JSONB → public.work_entities
 *
 * ADR-0029 정합:
 * - entity_type = 'character' (고정)
 * - source = 'seed' (고정)
 * - canonical_name = character.name (trim)
 * - brief = character.summary
 * - attributes = { role, personality, abilities, goals, relationships }
 * - aliases = '{}' (초기)
 * - first_seen_episode = NULL (seed = 회차 미특정)
 *
 * 충돌 처리: ON CONFLICT (work_id, entity_type, canonical_name) DO NOTHING.
 *
 * 실행: tsx scripts/seed-work-entities-from-character-settings.ts
 * 환경: SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL 필요 (.env.local).
 * 실행 = LEE 승인 후 1회 only.
 */
import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";

type CharacterSetting = {
  name?: unknown;
  summary?: unknown;
  role?: unknown;
  personality?: unknown;
  abilities?: unknown;
  goals?: unknown;
  relationships?: unknown;
};

type WorkRow = {
  id: number;
  title: string | null;
  character_settings: unknown;
};

function trimOrEmpty(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function pickAttributes(c: CharacterSetting): Record<string, string> {
  const out: Record<string, string> = {};
  const role = trimOrEmpty(c.role);
  const personality = trimOrEmpty(c.personality);
  const abilities = trimOrEmpty(c.abilities);
  const goals = trimOrEmpty(c.goals);
  const relationships = trimOrEmpty(c.relationships);
  if (role) out.role = role;
  if (personality) out.personality = personality;
  if (abilities) out.abilities = abilities;
  if (goals) out.goals = goals;
  if (relationships) out.relationships = relationships;
  return out;
}

(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 필요.");
    process.exit(1);
  }

  const admin = createClient(url, key, { auth: { persistSession: false } });

  const { data: works, error: wErr } = await admin
    .from("works")
    .select("id, title, character_settings")
    .is("deleted_at", null);

  if (wErr) {
    console.error("works fetch 실패:", wErr.message);
    process.exit(1);
  }

  const stats = { works: 0, candidates: 0, inserted: 0, skipped: 0, errors: 0 };

  for (const w of (works ?? []) as WorkRow[]) {
    stats.works += 1;
    const arr = w.character_settings;
    if (!Array.isArray(arr) || arr.length === 0) continue;

    for (const raw of arr) {
      if (!raw || typeof raw !== "object") continue;
      const c = raw as CharacterSetting;
      const canonicalName = trimOrEmpty(c.name);
      if (!canonicalName) continue;
      stats.candidates += 1;

      const brief = trimOrEmpty(c.summary) || null;
      const attributes = pickAttributes(c);

      const { error: insErr } = await admin
        .from("work_entities")
        .insert({
          work_id: w.id,
          entity_type: "character",
          canonical_name: canonicalName,
          aliases: [],
          brief,
          attributes,
          source: "seed",
          first_seen_episode: null,
        });

      if (insErr) {
        if (insErr.code === "23505") {
          stats.skipped += 1;
        } else {
          stats.errors += 1;
          console.warn(
            `[work ${w.id} / "${canonicalName}"] insert 실패:`,
            insErr.message
          );
        }
      } else {
        stats.inserted += 1;
      }
    }
  }

  console.log("=== seed 결과 ===");
  console.log(`works 전수: ${stats.works}`);
  console.log(`character 후보: ${stats.candidates}`);
  console.log(`insert 성공: ${stats.inserted}`);
  console.log(`UNIQUE 중복 skip: ${stats.skipped}`);
  console.log(`기타 오류: ${stats.errors}`);
})();
