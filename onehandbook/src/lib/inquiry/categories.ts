// 1:1 문의 카테고리 (ADR-0008 후속).
// DB 컬럼 inquiries.category 의 권위 있는 enum. 컨슈머 폼 / 어드민 / 유저 문의함 공통 사용.

export const INQUIRY_CATEGORIES = [
  { value: "usage", label: "사용 방법" },
  { value: "error", label: "오류 신고" },
  { value: "payment", label: "NAT/결제" },
  { value: "account", label: "계정" },
  { value: "quality", label: "분석 품질" },
  { value: "general", label: "제안/기타" },
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
