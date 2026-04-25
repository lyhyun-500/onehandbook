/** works.world_setting JSONB — 필드 누락·형식 오류 시 옵셔널 */
export type WorldSetting = {
  era?: string;
  rules?: string;
  background?: string;
} | null;

export const SIDEPANEL_CHARACTER_ROLES = [
  "주인공",
  "조연",
  "단역",
  "악역",
  "기타",
] as const;

export type SidePanelRole = (typeof SIDEPANEL_CHARACTER_ROLES)[number];

const SIDEPANEL_ROLE_SET = new Set<string>(SIDEPANEL_CHARACTER_ROLES);

export function normalizeRoleForSidePanel(role?: string): string {
  if (!role) return "조연"; // 기본값
  // legacy: 작품설정(v1)에서 쓰던 "조력자"를 "조연"으로 자동 매핑
  if (role === "조력자") return "조연";
  if (SIDEPANEL_ROLE_SET.has(role)) return role;
  return "기타"; // 알 수 없는 값
}

export type Character = {
  name: string;
  summary?: string;
  role?: string;
  goals?: string;
  abilities?: string;
  personality?: string;
  relationships?: string;
};

export type CharacterSettings = Character[] | null;

/** React key·상태용 — DB 저장 시 제외 */
export type CharacterWithKey = Character & {
  _key: string;
};
