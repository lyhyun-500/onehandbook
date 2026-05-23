// FAQ 카테고리 섹션 — Phase 2-D-10.
// 시안 design_novel/novel-agent/faq.jsx L151-175 정합.
// InquiryCategoryChip = 시안 명시 재사용 (src/components/inquiries/atoms.tsx).

import { InquiryCategoryChip } from "@/components/inquiries/atoms";
import { FAQItem } from "@/components/faq/FAQItem";
import {
  FAQ_CATEGORY_LABELS,
  type FAQCategory,
  type FAQItem as FAQItemData,
} from "@/lib/faq/data";

interface FAQCategorySectionProps {
  category: FAQCategory;
  items: readonly FAQItemData[];
  openMap: Record<string, boolean>;
  onToggle: (id: string) => void;
}

export function FAQCategorySection({
  category,
  items,
  openMap,
  onToggle,
}: FAQCategorySectionProps) {
  return (
    <section id={`faq-${category}`} className="scroll-mt-32">
      <header className="mb-4 flex items-baseline justify-between border-b border-stone-800/60 pb-3">
        <div className="flex items-baseline gap-3">
          <InquiryCategoryChip category={category} />
          <h2 className="font-serif text-[17px] font-medium text-stone-100">
            {FAQ_CATEGORY_LABELS[category]}
          </h2>
        </div>
        <span className="font-mono text-[10.5px] tabular-nums text-stone-500">
          {items.length}건
        </span>
      </header>
      <div>
        {items.map((item) => (
          <FAQItem
            key={item.id}
            item={item}
            open={!!openMap[item.id]}
            onToggle={() => onToggle(item.id)}
          />
        ))}
      </div>
    </section>
  );
}
