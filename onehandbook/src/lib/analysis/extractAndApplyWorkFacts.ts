/**
 * extractAndApplyWorkFacts — 추출 + 영속화 entry orchestration.
 *
 * ADR-0029 정합:
 * - 서비스 service_role 클라이언트 단독 (RLS 우회, 쓰기 전용 path).
 * - 비차단: 단계 어느 곳 실패해도 throw 함 → 호출자 best-effort 흡수.
 * - 단계: registry fetch → 결정적 후보 → Haiku → 5단계 영속화.
 */
import { createSupabaseServiceRole } from "@/lib/supabase/serviceRole";
import {
  resolveEntityCandidates,
  formatCandidatesForPrompt,
  type EntityRegistryRow,
} from "./resolveEntityCandidates";
import { extractWorkFacts } from "./extractWorkFacts";
import { applyWorkFactsExtraction } from "./applyWorkFactsExtraction";

export interface ExtractAndApplyInput {
  workId: number;
  workTitle: string;
  genre: string;
  episodeId: number;
  episodeNumber: number;
  episodeContent: string;
  episodeContentHash: string;
  sourceJobId: string | null;
}

/** 회차 본문 안 mention 후보 추출 — 한글 인명 prelim filter. */
function extractMentionsFromBody(body: string): string[] {
  // 한글 단어 2-6자 (인명 길이 휴리스틱).
  // ADR-0029 정합 — Haiku 가 본문 안 인물 mention 식별 가능하므로
  // resolveEntityCandidates 입력 = body 안 한글 토큰 후보.
  const tokens = body.match(/[가-힣]{2,6}/g) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tokens) {
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= 200) break; // 상한
  }
  return out;
}

function buildRegistryBlock(registry: EntityRegistryRow[]): string {
  if (registry.length === 0) return "";
  const lines = ["다음은 본 작품의 기존 엔티티입니다. ent_existing_{id} 형식으로 참조하세요."];
  for (const r of registry) {
    lines.push(
      `- ent_existing_${r.id} (${r.entity_type}, canonical="${r.canonical_name}"${
        r.brief ? `, brief="${r.brief}"` : ""
      }${
        r.aliases && r.aliases.length > 0 ? `, aliases=[${r.aliases.join(", ")}]` : ""
      })`,
    );
  }
  return lines.join("\n");
}

export async function extractAndApplyWorkFacts(
  input: ExtractAndApplyInput,
): Promise<void> {
  const sb = createSupabaseServiceRole();

  // content_hash 게이트 (ADR-0029 재분석 정책) — 동일 본문 + fact 존재 시 skip.
  // fact 0 (신규/백필) 또는 hash 불일치 (퇴고) = 추출 진행.
  const { data: existing } = await sb
    .from("work_facts")
    .select("episode_content_hash")
    .eq("work_id", input.workId)
    .eq("episode_id", input.episodeId)
    .limit(1)
    .maybeSingle();

  if (
    existing &&
    existing.episode_content_hash === input.episodeContentHash
  ) {
    return;
  }

  // 1. registry fetch
  const { data: regRows, error: regErr } = await sb
    .from("work_entities")
    .select("id, entity_type, canonical_name, aliases, brief")
    .eq("work_id", input.workId);

  if (regErr) {
    throw new Error(`[work-bible] registry fetch 실패: ${regErr.message}`);
  }
  const registry = (regRows ?? []) as EntityRegistryRow[];

  // 2. 결정적 후보 생성
  const mentions = extractMentionsFromBody(input.episodeContent);
  const candidates = resolveEntityCandidates(mentions, registry);
  // Haiku 비용 절감: 매칭 0건 mention 은 prompt 안 미포함 (신규 엔티티는 본문에서 찾으라고만 위임)
  const meaningful = candidates.filter((c) => c.matches.length >= 1);
  const candidatesBlock = formatCandidatesForPrompt(meaningful);
  const registryBlock = buildRegistryBlock(registry);

  // 3. Haiku 호출 + 파싱 + 1회 재시도
  const extraction = await extractWorkFacts({
    workTitle: input.workTitle,
    genre: input.genre,
    episodeNumber: input.episodeNumber,
    episodeBody: input.episodeContent,
    candidatesBlock,
    registryBlock,
  });

  // 4. 5단계 영속화 (best-effort)
  await applyWorkFactsExtraction(
    sb,
    {
      workId: input.workId,
      episodeId: input.episodeId,
      episodeNumber: input.episodeNumber,
      episodeContentHash: input.episodeContentHash,
      sourceJobId: input.sourceJobId,
    },
    registry,
    candidates,
    extraction,
  );
}
