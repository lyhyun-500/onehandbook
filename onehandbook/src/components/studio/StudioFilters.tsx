import { forwardRef, type HTMLAttributes } from "react";
import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudioWorkLayout } from "./StudioWorkCard";

export type StudioWorkFilter = "전체" | "연재중" | "휴재" | "완결";

const FILTERS: StudioWorkFilter[] = ["전체", "연재중", "휴재", "완결"];

export interface StudioFiltersProps extends HTMLAttributes<HTMLDivElement> {
  filter: StudioWorkFilter;
  onFilterChange: (filter: StudioWorkFilter) => void;
  layout: StudioWorkLayout;
  onLayoutChange: (layout: StudioWorkLayout) => void;
}

export const StudioFilters = forwardRef<HTMLDivElement, StudioFiltersProps>(
  function StudioFilters(
    { filter, onFilterChange, layout, onLayoutChange, className, ...props },
    ref,
  ) {
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-wrap items-center justify-between gap-3",
          className,
        )}
        {...props}
      >
        <div className="flex items-center gap-1" role="tablist" aria-label="작품 상태 필터">
          {FILTERS.map((f) => {
            const active = f === filter;
            return (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onFilterChange(f)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors",
                  active
                    ? "bg-stone-100/[0.06] text-stone-100"
                    : "text-stone-400 hover:text-stone-200",
                )}
              >
                {f}
              </button>
            );
          })}
        </div>

        <div
          className="flex items-center gap-1 rounded-md border border-stone-800/80 bg-stone-900/40 p-0.5"
          role="group"
          aria-label="레이아웃 토글"
        >
          <button
            type="button"
            aria-pressed={layout === "card"}
            aria-label="카드 레이아웃"
            onClick={() => onLayoutChange("card")}
            className={cn(
              "flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-medium transition-colors",
              layout === "card"
                ? "bg-stone-100/[0.06] text-stone-100"
                : "text-stone-400 hover:text-stone-200",
            )}
          >
            <LayoutGrid size={12} aria-hidden="true" />
            카드
          </button>
          <button
            type="button"
            aria-pressed={layout === "list"}
            aria-label="리스트 레이아웃"
            onClick={() => onLayoutChange("list")}
            className={cn(
              "flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-medium transition-colors",
              layout === "list"
                ? "bg-stone-100/[0.06] text-stone-100"
                : "text-stone-400 hover:text-stone-200",
            )}
          >
            <List size={12} aria-hidden="true" />
            리스트
          </button>
        </div>
      </div>
    );
  },
);
StudioFilters.displayName = "StudioFilters";
