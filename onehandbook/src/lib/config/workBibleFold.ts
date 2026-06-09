/**
 * 작품 바이블 L3 fold 주입 활성화 flag — 서버 전용.
 * ADR-0029 정합. 기본 off. 추출 flag (WORK_BIBLE_EXTRACTION_ENABLED) 와 분리.
 *
 * env: `WORK_BIBLE_FOLD_ENABLED=true` (또는 `1`) → on.
 * 그 외 모든 값 = off.
 */
export function isWorkBibleFoldEnabled(): boolean {
  const v = process.env.WORK_BIBLE_FOLD_ENABLED?.trim().toLowerCase();
  return v === "true" || v === "1";
}
