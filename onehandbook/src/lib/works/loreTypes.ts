export type WorldSetting = {
  background: string;
  era: string;
  rules: string;
};

export type CharacterSetting = {
  name: string;
  role: string;
  personality: string;
  abilities: string;
  goals: string;
  relationships: string;
};

import {
  SIDEPANEL_CHARACTER_ROLES,
} from "@/components/side-panel/types";

export const EMPTY_WORLD: WorldSetting = {
  background: "",
  era: "",
  rules: "",
};

/**
 * @deprecated Use `SIDEPANEL_CHARACTER_ROLES` as the single source of truth.
 * Kept as an alias for backward compatibility.
 */
export const CHARACTER_ROLES = SIDEPANEL_CHARACTER_ROLES;

export function emptyCharacter(): CharacterSetting {
  return {
    name: "",
    role: "주인공",
    personality: "",
    abilities: "",
    goals: "",
    relationships: "",
  };
}

export function normalizeWorldSetting(raw: unknown): WorldSetting {
  if (!raw || typeof raw !== "object") {
    return { ...EMPTY_WORLD };
  }
  const o = raw as Record<string, unknown>;
  return {
    background: typeof o.background === "string" ? o.background : "",
    era: typeof o.era === "string" ? o.era : "",
    rules: typeof o.rules === "string" ? o.rules : "",
  };
}

export function normalizeCharacterSettings(raw: unknown): CharacterSetting[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((item) => {
    if (!item || typeof item !== "object") {
      return emptyCharacter();
    }
    const o = item as Record<string, unknown>;
    const rawRole = typeof o.role === "string" ? o.role : "주인공";
    // NOTE: DB value is preserved (legacy "조력자" kept).
    // UI should use `normalizeRoleForSidePanel()` when presenting/selecting.
    const role =
      rawRole === "조력자" || CHARACTER_ROLES.some((r) => r === rawRole)
        ? rawRole
        : "주인공";
    return {
      name: typeof o.name === "string" ? o.name : "",
      role,
      personality: typeof o.personality === "string" ? o.personality : "",
      abilities: typeof o.abilities === "string" ? o.abilities : "",
      goals: typeof o.goals === "string" ? o.goals : "",
      relationships:
        typeof o.relationships === "string" ? o.relationships : "",
    };
  });
}
