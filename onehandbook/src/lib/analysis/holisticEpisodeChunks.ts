/** 통합 분석 청크 단위(클라이언트·서버 공통). */
export const HOLISTIC_CLIENT_CHUNK_SIZE = 10;

export function splitEpisodeIdsIntoChunks(
  orderedEpisodeIds: number[],
  chunkSize: number = HOLISTIC_CLIENT_CHUNK_SIZE
): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < orderedEpisodeIds.length; i += chunkSize) {
    out.push(orderedEpisodeIds.slice(i, i + chunkSize));
  }
  return out;
}
