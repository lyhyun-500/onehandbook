/**
 * 모델이 JSON 뒤에 잡담·마크다운을 붙이거나 닫는 } 뒤에 문자열을 덧붙인 경우,
 * 첫 번째 최상위 `{ ... }` 블록만 잘라 `JSON.parse` 에 넘기기 위한 유틸.
 */
export function extractBalancedJsonObject(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```/m);
  const inner = (fenced ? fenced[1] : trimmed).trim();
  const start = inner.indexOf("{");
  if (start === -1) {
    throw new SyntaxError("JSON 객체 시작 { 를 찾을 수 없습니다.");
  }
  const s = inner.slice(start);
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === "\\") {
        escape = true;
        continue;
      }
      if (c === '"') {
        inString = false;
        continue;
      }
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return s.slice(0, i + 1);
    }
  }

  throw new SyntaxError("JSON 객체의 닫는 } 를 찾을 수 없습니다.");
}
