// FAQ 개별 Q&A accordion item — Phase 2-D-10.
// 시안 design_novel/novel-agent/faq.jsx L121-148 정합.

"use client";

import { ChevronDown } from "lucide-react";
import type { FAQItem as FAQItemData } from "@/lib/faq/data";

interface FAQItemProps {
  item: FAQItemData;
  open: boolean;
  onToggle: () => void;
}

export function FAQItem({ item, open, onToggle }: FAQItemProps) {
  return (
    <div className="border-b border-stone-800/60 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="group flex w-full items-start gap-4 px-1 py-5 text-left transition-colors hover:bg-stone-100/[0.02]"
        aria-expanded={open}
      >
        <span className="mt-0.5 shrink-0 font-mono text-[10.5px] uppercase tracking-[0.25em] text-sky-300/75">
          Q.
        </span>
        <span
          className={`min-w-0 flex-1 font-serif text-[15px] leading-snug ${
            open
              ? "text-stone-100"
              : "text-stone-200 group-hover:text-stone-100"
          }`}
        >
          {item.question}
        </span>
        <span
          className={`shrink-0 text-stone-500 transition-transform ${
            open
              ? "rotate-180 text-sky-300"
              : "group-hover:text-stone-300"
          }`}
        >
          <ChevronDown size={14} aria-hidden="true" />
        </span>
      </button>

      {open && (
        <div className="border-t border-stone-800/40 bg-stone-900/30 px-1 py-5 pl-9">
          <p
            className="whitespace-pre-wrap font-serif text-[13.5px] leading-[1.9] text-stone-300"
            style={{ textWrap: "pretty" }}
          >
            {item.answer}
          </p>
        </div>
      )}
    </div>
  );
}
