import type { Character, CharacterSettings, WorldSetting } from "./types";

/** DB/JSON 이 깨져도 UI 가 크래시하지 않도록 안전 파싱 */
export function parseWorldSetting(raw: unknown): WorldSetting {
  if (raw == null) return null;
  if (typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    era: typeof o.era === "string" ? o.era : undefined,
    rules: typeof o.rules === "string" ? o.rules : undefined,
    background: typeof o.background === "string" ? o.background : undefined,
  };
}

export function parseCharacterSettings(raw: unknown): CharacterSettings {
  if (raw == null) return null;
  if (!Array.isArray(raw)) return null;
  const out: Character[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const c = item as Record<string, unknown>;
    const name = typeof c.name === "string" ? c.name : "";
    if (!name.trim()) continue;
    out.push({
      name,
      role: typeof c.role === "string" ? c.role : undefined,
      goals: typeof c.goals === "string" ? c.goals : undefined,
      abilities: typeof c.abilities === "string" ? c.abilities : undefined,
      personality: typeof c.personality === "string" ? c.personality : undefined,
      relationships:
        typeof c.relationships === "string" ? c.relationships : undefined,
    });
  }
  return out.length > 0 ? out : null;
}
