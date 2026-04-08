const MAX_CHUNK = 1200;
const OVERLAP = 160;
const MIN_FLUSH = 80;

/**
 * 트렌드 문서(.txt/.md)를 의미 단위(문단 우선)로 나눕니다.
 * 긴 문단은 고정 길이 윈도로 자릅니다.
 */
export function chunkTrendsText(full: string): string[] {
  const normalized = full.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let buf = "";

  const flush = () => {
    const t = buf.trim();
    if (t.length >= MIN_FLUSH) chunks.push(t);
    buf = "";
  };

  const pushLong = (p: string) => {
    for (let i = 0; i < p.length; i += MAX_CHUNK - OVERLAP) {
      const slice = p.slice(i, i + MAX_CHUNK).trim();
      if (slice.length >= MIN_FLUSH) chunks.push(slice);
    }
  };

  for (const p of paragraphs) {
    if (p.length > MAX_CHUNK) {
      flush();
      pushLong(p);
      continue;
    }
    if (!buf) {
      buf = p;
      continue;
    }
    if (buf.length + p.length + 2 <= MAX_CHUNK) buf = `${buf}\n\n${p}`;
    else {
      flush();
      buf = p;
    }
  }
  flush();
  return chunks;
}
