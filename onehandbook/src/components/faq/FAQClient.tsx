// FAQ client wrapper — Phase 2-D-10.
// 시안 design_novel/novel-agent/faq.jsx L178-293 정합.
//
// LEE 결정 영속화:
// - 다중 펼침 (openMap state)
// - 기본 모두 접힘 (useState({}))
// - sticky 카테고리 navigator + IntersectionObserver active chip 자동 갱신
// - 카테고리 chip 클릭 = scrollIntoView smooth + active 동기화
// - 하단 helper card = 「1:1 문의 하기」 Link href=/account/inquiries

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Headset } from "lucide-react";
import { FAQCategorySection } from "@/components/faq/FAQCategorySection";
import {
  FAQ_CATEGORY_LABELS,
  FAQ_CATEGORY_ORDER,
  FAQ_ITEMS,
  type FAQCategory,
} from "@/lib/faq/data";

export function FAQClient() {
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const [activeCat, setActiveCat] = useState<FAQCategory>(
    FAQ_CATEGORY_ORDER[0]!,
  );

  function toggle(id: string) {
    setOpenMap((m) => ({ ...m, [id]: !m[id] }));
  }

  function scrollToCategory(id: FAQCategory) {
    setActiveCat(id);
    const el = document.getElementById(`faq-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // IntersectionObserver active chip 자동 갱신
  useEffect(() => {
    const sections = FAQ_CATEGORY_ORDER.map((c) =>
      document.getElementById(`faq-${c}`),
    ).filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          const id = visible[0].target.id.replace("faq-", "") as FAQCategory;
          setActiveCat(id);
        }
      },
      {
        rootMargin: "-30% 0px -60% 0px",
        threshold: [0, 0.25, 0.5, 1],
      },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  const grouped = useMemo(
    () =>
      FAQ_CATEGORY_ORDER.map((category) => ({
        category,
        items: FAQ_ITEMS.filter((item) => item.category === category),
      })),
    [],
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-8">
        <header className="pt-10 pb-7">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.3em] text-sky-300/75">
            1:1 문의 전에
          </div>
          <h1 className="mt-2 font-serif text-[34px] font-medium leading-tight tracking-tight text-stone-100">
            자주 묻는 질문 (FAQ)
          </h1>
          <p className="mt-3 max-w-2xl font-serif text-[13.5px] leading-relaxed text-stone-400">
            Novel Agent 사용 중 자주 받는 질문을 모았습니다. 원하는 답변이
            없다면{" "}
            <Link
              href="/account/inquiries"
              className="text-sky-300/90 underline-offset-2 hover:text-sky-200 hover:underline"
            >
              1:1 문의
            </Link>
            로 알려주세요.
          </p>
        </header>

        <div className="sticky top-0 z-20 -mx-8 border-b border-stone-800/60 bg-stone-950/85 backdrop-blur">
          <div className="mx-auto max-w-3xl px-8 py-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.25em] text-stone-500">
                카테고리
              </span>
              {FAQ_CATEGORY_ORDER.map((c) => {
                const isActive = activeCat === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => scrollToCategory(c)}
                    className={`rounded-full border px-2.5 py-1 font-serif text-[12px] transition-colors ${
                      isActive
                        ? "border-sky-400/40 bg-sky-400/[0.10] text-sky-100"
                        : "border-stone-800 bg-stone-900/40 text-stone-300 hover:border-stone-700 hover:text-stone-100"
                    }`}
                  >
                    {FAQ_CATEGORY_LABELS[c]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <main className="flex flex-col gap-14 pt-8 pb-10">
          {grouped.map(({ category, items }) => (
            <FAQCategorySection
              key={category}
              category={category}
              items={items}
              openMap={openMap}
              onToggle={toggle}
            />
          ))}
        </main>

        <footer className="mb-14 rounded-xl border border-stone-800/70 bg-stone-900/30 px-7 py-6">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div className="min-w-0">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.25em] text-sky-300/75">
                아직 해결되지 않으셨나요?
              </div>
              <h3 className="mt-1.5 font-serif text-[17px] font-medium text-stone-100">
                원하는 답변을 찾지 못하셨다면
              </h3>
              <p className="mt-1 font-serif text-[12.5px] leading-relaxed text-stone-400">
                평일 10:00 ~ 18:00 운영팀이 직접 답변드립니다. 답변은 사이트
                알림으로 안내됩니다.
              </p>
            </div>
            <Link
              href="/account/inquiries"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-sky-400 px-5 py-2.5 font-serif text-[13px] font-medium text-stone-950 hover:bg-sky-300"
            >
              <Headset size={12} aria-hidden="true" />
              1:1 문의 하기
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
