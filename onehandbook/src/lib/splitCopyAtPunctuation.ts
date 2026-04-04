/**
 * UI 문구에서 마침표·쉼표 뒤 줄바꿈용 분할.
 * - 숫자 천 단위(1,000), 소수(3.14)는 분할하지 않음
 * - 영문 도메인/식별자 형태(foo.com)의 점은 분할하지 않음
 */
export function splitCopyAtPunctuation(text: string): string[] {
  if (!text) return [];
  const parts: string[] = [];
  let start = 0;
  const n = text.length;

  for (let i = 0; i < n; i++) {
    const c = text[i];
    if (c !== "," && c !== ".") continue;

    const prev = i > 0 ? text[i - 1] : "";
    const next = i + 1 < n ? text[i + 1] : "";

    if (c === ",") {
      if (/\d/.test(prev) && /\d/.test(next)) continue;
    }
    if (c === ".") {
      if (/\d/.test(prev) && /\d/.test(next)) continue;
      if (/[a-zA-Z0-9_-]/.test(prev) && /[a-zA-Z]/.test(next)) continue;
      if (next === ".") continue;
      if (
        prev === "." &&
        next !== " " &&
        next !== "\n" &&
        i < n - 1
      ) {
        continue;
      }
    }

    const chunk = text.slice(start, i + 1).trimEnd();
    if (chunk) parts.push(chunk);
    start = i + 1;
    while (start < n && text[start] === " ") start++;
    i = start - 1;
  }

  const rest = text.slice(start).trim();
  if (rest) parts.push(rest);
  return parts.length > 0 ? parts : [text];
}
