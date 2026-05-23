"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 시안 `design_novel/novel-agent/pricing.jsx:244-287` 정합 — 4문항 accordion.
 * 첫 항목 default open (시안 line 267 정합).
 */
const NAT_FAQ: { q: string; a: string }[] = [
  {
    q: "NAT는 환불되나요?",
    a: "결제 후 7일 이내, 사용하지 않은 NAT에 한해 전액 환불됩니다. 일부 사용한 경우, 잔여 NAT × 단가 기준으로 부분 환불해 드립니다. 환불은 [문의함 → 결제·NAT] 분류로 접수해주세요.",
  },
  {
    q: "NAT는 언제 차감되나요?",
    a: "회차 분석을 시작하는 시점에 예상 NAT가 차감되며, 분석이 실패한 경우 자동으로 복원됩니다. 진행 중인 작업이 30분 내에 끝나지 않으면 차감분이 자동 환원됩니다.",
  },
  {
    q: "베타 종료 후 가격이 바뀌나요?",
    a: "베타 기간 동안 충전한 NAT는 만료되지 않습니다. 정식 출시 후 패키지 가격은 변동될 수 있으나, 기존 잔량은 그대로 사용 가능합니다.",
  },
  {
    q: "회사·팀 단위로 결제할 수 있나요?",
    a: "현재는 개인 결제만 지원합니다. 사업자 발행 세금계산서가 필요한 경우 [문의함]을 통해 별도 안내드립니다.",
  },
];

export function FAQSection() {
  const [openIdx, setOpenIdx] = useState<number>(0);

  return (
    <section className="overflow-hidden rounded-lg border border-stone-800/60 bg-stone-900/30">
      <header className="border-b border-stone-800/60 px-5 py-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-sky-300/70">
          FAQ
        </div>
        <h3 className="mt-0.5 font-serif text-[15px] text-stone-100">
          자주 묻는 질문
        </h3>
      </header>

      {NAT_FAQ.map((item, i) => {
        const open = openIdx === i;
        return (
          <div
            key={item.q}
            className="border-b border-stone-800/50 last:border-b-0"
          >
            <button
              type="button"
              onClick={() => setOpenIdx(open ? -1 : i)}
              aria-expanded={open}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-stone-100/[0.02]"
            >
              <span
                className={cn(
                  "font-serif text-[13.5px]",
                  open ? "text-stone-100" : "text-stone-200",
                )}
              >
                {item.q}
              </span>
              <ChevronDown
                size={13}
                aria-hidden="true"
                className={cn(
                  "shrink-0 transition-transform",
                  open ? "rotate-180 text-sky-300" : "text-stone-500",
                )}
              />
            </button>
            {open && (
              <div className="px-5 pb-5 pt-0">
                <p className="font-serif text-[12.5px] leading-relaxed text-stone-400">
                  {item.a}
                </p>
              </div>
            )}
          </div>
        );
      })}

      <div className="border-t border-stone-800/60 bg-stone-950/40 px-5 py-3 text-[11px] text-stone-500">
        해결되지 않으셨나요?{" "}
        <a
          href="/account/inquiries"
          className="text-sky-300/85 hover:text-sky-200"
        >
          문의함 → 결제·NAT
        </a>{" "}
        으로 접수해주세요.
      </div>
    </section>
  );
}
