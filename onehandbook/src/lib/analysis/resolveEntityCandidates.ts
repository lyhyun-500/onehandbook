/**
 * resolveEntityCandidates — 결정적 후보 생성 (Haiku 호출 앞단).
 *
 * ADR-0029 정합:
 * - 한국 성씨 사전 strip → given-name suffix 매칭.
 * - 유일 후보 (1건) = 강한 힌트 + 자동 alias 병합 신호.
 * - 복수 후보 (2건+) = 전부 제시, Haiku 가 brief 컨텍스트로 선택.
 * - 미매칭 = 호칭/별호 path = 후보 0 (Haiku 가 brief 컨텍스트 판단).
 */
import { stripKoreanSurname } from "./koreanSurnames";

export type EntityRegistryRow = {
  id: number;
  entity_type: string;
  canonical_name: string;
  aliases: string[] | null;
  brief: string | null;
};

export type EntityCandidate = {
  mention: string;
  /** mention 에서 성씨 strip 후 given-name (null = strip 비대상) */
  givenName: string | null;
  /** 매칭된 registry rows (0/1/N 분기) */
  matches: EntityRegistryRow[];
};

/**
 * mention 1건에 대한 결정적 매칭.
 * - mention 자체가 canonical_name 또는 alias 완전 일치 = 매칭.
 * - 성씨 strip 후 given-name suffix 매칭 = canonical_name 또는 alias 에 endsWith.
 */
function matchOne(
  mention: string,
  registry: EntityRegistryRow[]
): EntityCandidate {
  const m = mention.trim();
  const given = stripKoreanSurname(m);
  const matches: EntityRegistryRow[] = [];

  for (const r of registry) {
    const names = [r.canonical_name, ...(r.aliases ?? [])];
    const exact = names.some((n) => n.trim() === m);
    if (exact) {
      matches.push(r);
      continue;
    }
    if (given) {
      const suffix = names.some((n) => {
        const t = n.trim();
        return t === given || t.endsWith(given);
      });
      if (suffix) matches.push(r);
    }
  }

  // 중복 제거 (같은 entity 가 canonical + alias 양쪽 매칭 시)
  const seen = new Set<number>();
  const unique = matches.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });

  return { mention: m, givenName: given, matches: unique };
}

/**
 * mention 배열 → 후보 목록.
 * 빈 문자열 / 중복 mention 제거.
 */
export function resolveEntityCandidates(
  mentions: string[],
  registry: EntityRegistryRow[]
): EntityCandidate[] {
  const seen = new Set<string>();
  const out: EntityCandidate[] = [];
  for (const raw of mentions) {
    const m = (raw ?? "").trim();
    if (!m || seen.has(m)) continue;
    seen.add(m);
    out.push(matchOne(m, registry));
  }
  return out;
}

/**
 * Haiku user 영역에 주입할 후보 힌트 텍스트 빌더.
 * - 유일 후보 = "강한 힌트" 라벨.
 * - 복수 후보 = "후보 N건" 라벨 + 각 brief.
 * - 0 후보 = mention 자체만 제시.
 */
export function formatCandidatesForPrompt(
  candidates: EntityCandidate[]
): string {
  if (candidates.length === 0) return "";
  const lines: string[] = ["## 결정적 후보 (성씨 strip 매칭)"];
  for (const c of candidates) {
    if (c.matches.length === 1) {
      const r = c.matches[0];
      lines.push(
        `- mention "${c.mention}" = ent_existing_${r.id} 강한 후보 (canonical="${r.canonical_name}"${r.brief ? `, brief="${r.brief}"` : ""})`
      );
    } else if (c.matches.length >= 2) {
      lines.push(`- mention "${c.mention}" = 복수 후보 (${c.matches.length}건). 문맥으로 선택:`);
      for (const r of c.matches) {
        lines.push(
          `  · ent_existing_${r.id} (canonical="${r.canonical_name}"${r.brief ? `, brief="${r.brief}"` : ""})`
        );
      }
    } else {
      lines.push(`- mention "${c.mention}" = 후보 0 (신규 엔티티 또는 호칭/별호)`);
    }
  }
  return lines.join("\n");
}
