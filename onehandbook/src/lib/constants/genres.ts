export const GENRES = [
  "현대",
  "판타지",
  "로맨스",
  "로맨스 판타지",
  "무협",
  "스포츠",
  "BL",
  "기타",
] as const;

export type Genre = (typeof GENRES)[number];

const GENRE_SET: Set<string> = new Set(GENRES);

/** genre_legacy 보존 컬럼이 있어 데이터 손실은 없으나, 현 enum 외 값을 가진 작품 편집 시 빈 select 방지용. */
export function isKnownGenre(value: string): boolean {
  return GENRE_SET.has(value);
}
