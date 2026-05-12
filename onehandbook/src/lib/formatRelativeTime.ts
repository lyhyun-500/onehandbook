/**
 * 한국어 상대 시간 변환 유틸.
 *
 * 단계:
 *  - < 1분    : "방금"
 *  - < 1시간  : "X분 전"
 *  - < 24시간 : "X시간 전"
 *  - < 7일    : "X일 전"
 *  - < 30일   : "X주 전"
 *  - < 365일  : "X개월 전"
 *  - 그 외    : "X년 전"
 *
 * 입력이 미래 시각이면 "방금" 으로 처리 (시계 sync 오차 보호).
 * 입력 파싱 실패 시 빈 문자열 반환 — 호출처가 조건부 렌더링.
 *
 * 상대 시간 자체는 timezone 무관 (절대 차이만 사용).
 * 절대 시각 표기가 필요한 경우 formatAbsoluteTimeKst 사용.
 */
export function formatRelativeTime(
  input: string | number | Date | null | undefined,
  now: Date = new Date(),
): string {
  if (input == null) return "";
  const then = input instanceof Date ? input : new Date(input);
  const t = then.getTime();
  if (!Number.isFinite(t)) return "";

  const diffMs = now.getTime() - t;
  if (diffMs < 60_000) return "방금";

  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return `${diffMin}분 전`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}시간 전`;

  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}일 전`;

  if (diffDay < 30) {
    const weeks = Math.floor(diffDay / 7);
    return `${weeks}주 전`;
  }

  if (diffDay < 365) {
    const months = Math.floor(diffDay / 30);
    return `${months}개월 전`;
  }

  const years = Math.floor(diffDay / 365);
  return `${years}년 전`;
}

/**
 * KST(Asia/Seoul) 고정 절대 시각 포맷. `title` 속성 hover 노출용.
 * 형식: "2026-05-04 14:32 KST"
 */
export function formatAbsoluteTimeKst(
  input: string | number | Date | null | undefined,
): string {
  if (input == null) return "";
  const then = input instanceof Date ? input : new Date(input);
  if (!Number.isFinite(then.getTime())) return "";

  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(then);

  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")} KST`;
}
