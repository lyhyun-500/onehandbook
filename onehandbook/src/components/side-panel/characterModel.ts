import { SIDEPANEL_CHARACTER_ROLES, type Character, type CharacterSettings, type CharacterWithKey } from "./types";

export function stripCharacterKey(c: CharacterWithKey): Character {
  const { _key: _k, ...rest } = c;
  return rest;
}

export function stripAllKeys(chars: CharacterWithKey[]): Character[] {
  return chars.map(stripCharacterKey);
}

function newRuntimeKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `char-${crypto.randomUUID()}`;
  }
  return `char-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function makeCharactersWithKeys(
  settings: CharacterSettings
): CharacterWithKey[] {
  const list = settings ?? [];
  return list.map((c) => ({
    name: c.name ?? "",
    summary: c.summary,
    role: c.role,
    goals: c.goals,
    abilities: c.abilities,
    personality: c.personality,
    relationships: c.relationships,
    _key: newRuntimeKey(),
  }));
}

export function emptyCharacterRow(): CharacterWithKey {
  return {
    name: "",
    summary: "",
    // Aligns with normalizeRoleForSidePanel default + role select; header badge uses raw role
    role: SIDEPANEL_CHARACTER_ROLES[1] ?? "조연",
    goals: "",
    abilities: "",
    personality: "",
    relationships: "",
    _key: newRuntimeKey(),
  };
}

function normalizeChar(c: Character): Record<string, string> {
  return {
    name: c.name ?? "",
    summary: c.summary ?? "",
    role: c.role ?? "",
    goals: c.goals ?? "",
    abilities: c.abilities ?? "",
    personality: c.personality ?? "",
    relationships: c.relationships ?? "",
  };
}

export function charactersEqual(a: Character, b: Character): boolean {
  return JSON.stringify(normalizeChar(a)) === JSON.stringify(normalizeChar(b));
}
