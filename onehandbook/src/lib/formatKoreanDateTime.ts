/**
 * SSR( Node )와 브라우저에서 동일한 문자열을 내기 위한 날짜 포맷.
 * toLocaleString("ko-KR")은 런타임마다 PM vs 오후 등으로 달라져 hydration 오류가 난다.
 */
const seoulDateTime = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export function formatKoreanDateTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return seoulDateTime.format(d);
}
