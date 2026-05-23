// 1:1 문의 카테고리 — Phase 2-D-9 (commit 2) 시안 enum 정합.
// DB 컬럼 inquiries.category 의 권위 있는 enum (CHECK constraint 정합).
// 컨슈머 폼 / 어드민 / 유저 문의함 공통 사용.
//
// hue = InquiryCategoryChip atom 의 동적 색상 (시안 design_novel/novel-agent/inquiries.jsx L3-10 정합).

export const INQUIRY_CATEGORIES = [
  { value: "billing", label: "결제·NAT", hue: 30 },
  { value: "analysis", label: "분석 결과", hue: 240 },
  { value: "bug", label: "버그·오류", hue: 0 },
  { value: "account", label: "계정", hue: 280 },
  { value: "feature", label: "기능 제안", hue: 140 },
  { value: "etc", label: "기타", hue: 200 },
] as const;

export type InquiryCategory = (typeof INQUIRY_CATEGORIES)[number]["value"];

export const INQUIRY_CATEGORY_VALUES: readonly InquiryCategory[] =
  INQUIRY_CATEGORIES.map((c) => c.value);

export function isInquiryCategory(v: unknown): v is InquiryCategory {
  return (
    typeof v === "string" &&
    (INQUIRY_CATEGORY_VALUES as readonly string[]).includes(v)
  );
}

export function inquiryCategoryLabel(value: string): string {
  const hit = INQUIRY_CATEGORIES.find((c) => c.value === value);
  return hit?.label ?? value;
}

export function inquiryCategoryHue(value: string): number {
  const hit = INQUIRY_CATEGORIES.find((c) => c.value === value);
  return hit?.hue ?? 200;
}
