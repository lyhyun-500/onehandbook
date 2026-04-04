import md5 from "md5";

/** UTF-8 원고 본문 MD5(hex). 분석·저장 시 동일 알고리즘 유지 */
export function md5Hex(content: string): string {
  return md5(content);
}
