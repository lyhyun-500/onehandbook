import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const GENRE_COLORS: Record<string, string> = {
  로맨스: "bg-rose-300/20 text-rose-300",
  판타지: "bg-violet-300/20 text-violet-300",
  무협: "bg-amber-300/20 text-amber-300",
  현대물: "bg-sky-300/20 text-sky-300",
  스포츠: "bg-emerald-300/20 text-emerald-300",
};

const FALLBACK_CLASS = "bg-stone-700/40 text-stone-300";

export interface GenreTagProps extends HTMLAttributes<HTMLSpanElement> {
  genre: string;
}

export const GenreTag = forwardRef<HTMLSpanElement, GenreTagProps>(
  function GenreTag({ genre, className, ...props }, ref) {
    const colorClass = GENRE_COLORS[genre] ?? FALLBACK_CLASS;
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center rounded px-2 py-0.5 text-[10.5px] font-medium",
          colorClass,
          className,
        )}
        {...props}
      >
        {genre}
      </span>
    );
  },
);
GenreTag.displayName = "GenreTag";
