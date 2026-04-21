/** works.world_setting JSONB — 필드 누락·형식 오류 시 옵셔널 */
export type WorldSetting = {
  era?: string;
  rules?: string;
  background?: string;
} | null;

export type Character = {
  name: string;
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
