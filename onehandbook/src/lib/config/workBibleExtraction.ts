/**
 * 작품 바이블 추출 후행 훅 활성화 flag — 서버 전용.
 * ADR-0029 정합. 기본 off.
 *
 * env: `WORK_BIBLE_EXTRACTION_ENABLED=true` (또는 `1`) → on.
 * 그 외 모든 값 = off.
 */
export function isWorkBibleExtractionEnabled(): boolean {
  const v = process.env.WORK_BIBLE_EXTRACTION_ENABLED?.trim().toLowerCase();
  return v === "true" || v === "1";
}
