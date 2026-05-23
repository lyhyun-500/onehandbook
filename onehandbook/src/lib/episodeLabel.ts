type EpisodeForLabel = {
  episode_number: number;
  title: string | null;
};

type FormatOptions = {
  withTitle?: boolean;
};

/**
 * 회차 표기 통합 헬퍼.
 *
 * - episode_number < 100: 2자리 zero-pad (EP.01, EP.08)
 * - episode_number >= 100: 자연 표기 (EP.100)
 * - title 부재 (null / 빈 문자열 / 공백만) 또는 withTitle:false: 인덱스만
 *
 * 예시:
 * - { episode_number: 8, title: "8화" } → "EP.08 · 8화"
 * - { episode_number: 0, title: "프롤로그" } → "EP.00 · 프롤로그"
 * - { episode_number: 8, title: null } → "EP.08"
 * - { episode_number: 100, title: "본격 시작" } → "EP.100 · 본격 시작"
 */
export function formatEpisodeLabel(
  episode: EpisodeForLabel,
  options?: FormatOptions,
): string {
  const { episode_number, title } = episode;
  const withTitle = options?.withTitle ?? true;

  const indexLabel =
    episode_number < 100
      ? `EP.${String(episode_number).padStart(2, "0")}`
      : `EP.${episode_number}`;

  if (!withTitle) return indexLabel;

  const trimmedTitle = title?.trim();
  if (!trimmedTitle) return indexLabel;

  return `${indexLabel} · ${trimmedTitle}`;
}
