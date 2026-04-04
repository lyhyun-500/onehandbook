/** 회차 본문 최대 글자 수 (한 번에 대량 등록하는 것을 막기 위한 정책) */
export const EPISODE_CONTENT_MAX_CHARS = 10_000;

/** 사용자에게 보여줄 설명용 */
export const EPISODE_CONTENT_MAX_LABEL = "1만 자";

/** JS에서의 글자 수 (유니코드 코드 포인트 기준, 이모지 등은 1자로 셈) */
export function countEpisodeContentChars(text: string): number {
  return [...text].length;
}

export function clampEpisodeContent(text: string): string {
  const chars = [...text];
  if (chars.length <= EPISODE_CONTENT_MAX_CHARS) return text;
  return chars.slice(0, EPISODE_CONTENT_MAX_CHARS).join("");
}

export function isEpisodeContentWithinLimit(text: string): boolean {
  return countEpisodeContentChars(text) <= EPISODE_CONTENT_MAX_CHARS;
}

/**
 * 본문 입력 변경 시: 1만자 이하 유지, 1만자 초과 상태에서는 줄이는 것만 허용하고
 * 길이를 늘리는 편집은 막음(기존 DB에 긴 글이 있어도 잘리지 않게).
 */
export function applyEpisodeContentChange(prev: string, next: string): string {
  const n = countEpisodeContentChars(next);
  const prevN = countEpisodeContentChars(prev);
  if (n <= EPISODE_CONTENT_MAX_CHARS) return next;
  if (n < prevN) return next;
  if (prevN <= EPISODE_CONTENT_MAX_CHARS) return clampEpisodeContent(next);
  return prev;
}
