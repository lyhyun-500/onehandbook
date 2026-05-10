/**
 * className merge — 0 dep helper (ADR-0024).
 * tailwind-merge 미도입이므로 동일 카테고리 utility 충돌 시 뒤에 박힌 값이 우선되지 않음.
 * atoms 작성 시 props.className 을 base 뒤에 박아 호출자 override 가 가능하도록 박음.
 */
export function cn(...inputs: (string | undefined | null | false | 0)[]): string {
  return inputs.filter(Boolean).join(" ");
}
