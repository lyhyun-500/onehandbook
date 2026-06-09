/**
 * buildWorkContextBlock — L3 fold 주입 (ADR-0029 정합).
 *
 * 입력: workId (파이프라인 work.id 단독, 사용자 입력 금지) + episodeNumber.
 * 출력: system prompt 안 주입할 텍스트 블록 (빈 string 가능).
 *
 * 알고리즘:
 *   1. episodeNumber <= 1 = 빈 블록 (이전 fact 0)
 *   2. work_facts WHERE work_id AND episode_number < N (service_role)
 *   3. work_entities 합집합 SELECT → canonical_name 치환 Map
 *   4. 4그룹 압축:
 *      ① 미회수 복선 (foreshadow_planted - foreshadow_resolved 차집합, entity 기준)
 *      ② 인물 마지막 state_change (character entity 별 가장 최근)
 *      ③ 쌍별 마지막 relationship_change (entity pair 별)
 *      ④ 최근 event (시간 역순, capacity 남은 만큼)
 *   5. char budget 2,000 (≈ 3,000 토큰 ÷ ~1.5 tok/char, 운영 usage 실측 후 보정)
 *      우선순위: ① > ② > ③ > ④ (④ 부터 truncate)
 *   6. content 텍스트 사용 (value 미사용).
 *   7. error / 0건 = 빈 string (non-blocking).
 */
import "server-only";
import { createSupabaseServiceRole } from "@/lib/supabase/serviceRole";

export interface BuildWorkContextBlockInput {
  workId: number;
  episodeNumber: number;
}

/** 운영 usage 실측 후 보정 — 한국어 ≈ 1.5 token/char → 3,000 tok ≈ 2,000 char. */
const CHAR_BUDGET = 2000;

type FactRow = {
  id: number;
  fact_type: string;
  entity_ids: number[] | null;
  content: string;
  episode_number: number;
  created_at: string;
};

type EntityRow = {
  id: number;
  canonical_name: string;
  entity_type: string;
};

function safeEntityIds(f: FactRow): number[] {
  return Array.isArray(f.entity_ids) ? f.entity_ids : [];
}

function nameOf(map: Map<number, EntityRow>, id: number): string {
  return map.get(id)?.canonical_name ?? `ent_${id}`;
}

/** ① 미회수 복선 = foreshadow_planted 의 foreshadow entity − resolved 의 foreshadow entity. */
function buildUnresolvedForeshadow(
  facts: FactRow[],
  entitiesMap: Map<number, EntityRow>,
): string[] {
  const planted = new Map<number, FactRow>();
  const resolved = new Set<number>();
  for (const f of facts) {
    const ids = safeEntityIds(f);
    if (f.fact_type === "foreshadow_planted") {
      for (const id of ids) {
        if (entitiesMap.get(id)?.entity_type !== "foreshadow") continue;
        const prev = planted.get(id);
        if (
          !prev ||
          f.episode_number > prev.episode_number ||
          (f.episode_number === prev.episode_number && f.created_at > prev.created_at)
        ) {
          planted.set(id, f);
        }
      }
    } else if (f.fact_type === "foreshadow_resolved") {
      for (const id of ids) {
        if (entitiesMap.get(id)?.entity_type === "foreshadow") resolved.add(id);
      }
    }
  }
  const lines: string[] = [];
  for (const [id, f] of planted.entries()) {
    if (resolved.has(id)) continue;
    lines.push(`- (${f.episode_number}화 / ${nameOf(entitiesMap, id)}) ${f.content}`);
  }
  return lines;
}

/** ② 인물 마지막 state_change — character entity 별 가장 최근 1건. */
function buildLastStateChange(
  facts: FactRow[],
  entitiesMap: Map<number, EntityRow>,
): string[] {
  const last = new Map<number, FactRow>();
  for (const f of facts) {
    if (f.fact_type !== "state_change") continue;
    for (const id of safeEntityIds(f)) {
      if (entitiesMap.get(id)?.entity_type !== "character") continue;
      const prev = last.get(id);
      if (
        !prev ||
        f.episode_number > prev.episode_number ||
        (f.episode_number === prev.episode_number && f.created_at > prev.created_at)
      ) {
        last.set(id, f);
      }
    }
  }
  const lines: string[] = [];
  for (const [id, f] of last.entries()) {
    lines.push(`- ${nameOf(entitiesMap, id)}: (${f.episode_number}화) ${f.content}`);
  }
  return lines;
}

/** ③ 쌍별 마지막 relationship_change — sorted entity pair 별 가장 최근 1건. */
function buildLastRelationshipChange(
  facts: FactRow[],
  entitiesMap: Map<number, EntityRow>,
): string[] {
  const last = new Map<string, { fact: FactRow; pair: [number, number] }>();
  for (const f of facts) {
    if (f.fact_type !== "relationship_change") continue;
    const ids = safeEntityIds(f);
    if (ids.length < 2) continue;
    const sorted = [...ids].sort((a, b) => a - b);
    const key = `${sorted[0]}|${sorted[1]}`;
    const prev = last.get(key);
    if (
      !prev ||
      f.episode_number > prev.fact.episode_number ||
      (f.episode_number === prev.fact.episode_number && f.created_at > prev.fact.created_at)
    ) {
      last.set(key, { fact: f, pair: [sorted[0], sorted[1]] });
    }
  }
  const lines: string[] = [];
  for (const { fact, pair } of last.values()) {
    lines.push(
      `- ${nameOf(entitiesMap, pair[0])} ↔ ${nameOf(entitiesMap, pair[1])}: (${fact.episode_number}화) ${fact.content}`,
    );
  }
  return lines;
}

/** ④ 최근 event — episode_number DESC, created_at DESC. */
function buildRecentEvents(facts: FactRow[]): string[] {
  const events = facts.filter((f) => f.fact_type === "event");
  events.sort((a, b) => {
    if (b.episode_number !== a.episode_number) return b.episode_number - a.episode_number;
    return b.created_at.localeCompare(a.created_at);
  });
  return events.map((f) => `- ${f.episode_number}화: ${f.content}`);
}

/** 우선순위 truncate: 그룹별 라인 누적, char_budget 초과 시 다음 그룹 절단. */
function assembleWithBudget(groups: { title: string; lines: string[] }[]): string {
  const out: string[] = [
    "## 작품 바이블 — 이전 회차 누적 fact (read-only)",
    "",
    "본 작품의 이전 회차에서 추출된 fact 입니다. 본 회차 분석 시 인물·관계·복선 정합성 평가에 참고하세요.",
    "",
  ];
  let used = out.join("\n").length;

  for (const g of groups) {
    if (g.lines.length === 0) continue;
    const header = `### ${g.title}`;
    if (used + header.length + 1 > CHAR_BUDGET) break;
    out.push(header);
    used += header.length + 1;

    for (const line of g.lines) {
      if (used + line.length + 1 > CHAR_BUDGET) break;
      out.push(line);
      used += line.length + 1;
    }
    out.push("");
    used += 1;
  }

  return out.join("\n").trimEnd();
}

export async function buildWorkContextBlock(
  input: BuildWorkContextBlockInput,
): Promise<string> {
  if (!Number.isFinite(input.episodeNumber) || input.episodeNumber <= 1) {
    return "";
  }

  const sb = createSupabaseServiceRole();

  const { data: facts, error: fErr } = await sb
    .from("work_facts")
    .select("id, fact_type, entity_ids, content, episode_number, created_at")
    .eq("work_id", input.workId)
    .lt("episode_number", input.episodeNumber)
    .order("episode_number", { ascending: true })
    .order("created_at", { ascending: true });

  if (fErr || !facts || facts.length === 0) return "";

  const entityIdSet = new Set<number>();
  for (const f of facts as FactRow[]) {
    for (const id of safeEntityIds(f)) entityIdSet.add(id);
  }

  const entitiesMap = new Map<number, EntityRow>();
  if (entityIdSet.size > 0) {
    const { data: ents, error: eErr } = await sb
      .from("work_entities")
      .select("id, canonical_name, entity_type")
      .in("id", [...entityIdSet]);
    if (eErr) return "";
    for (const e of (ents ?? []) as EntityRow[]) entitiesMap.set(e.id, e);
  }

  const factRows = facts as FactRow[];
  const groups = [
    { title: "미회수 복선", lines: buildUnresolvedForeshadow(factRows, entitiesMap) },
    { title: "인물별 마지막 상태", lines: buildLastStateChange(factRows, entitiesMap) },
    { title: "관계 변화 (쌍별 마지막)", lines: buildLastRelationshipChange(factRows, entitiesMap) },
    { title: "최근 핵심 사건", lines: buildRecentEvents(factRows) },
  ];

  if (groups.every((g) => g.lines.length === 0)) return "";

  return assembleWithBudget(groups);
}
