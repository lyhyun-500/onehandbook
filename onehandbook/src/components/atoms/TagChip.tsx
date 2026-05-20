import { X } from "lucide-react";

/** 입력된 태그 칩 — × 클릭 시 onRemove. 시안 work-settings.jsx TagChip 정합. */
export function TagChip({
  tag,
  onRemove,
}: {
  tag: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-700/70 bg-stone-900/70 px-3 py-1 font-mono text-[11.5px] tabular-nums text-stone-200">
      <span>{tag}</span>
      <button
        type="button"
        onClick={onRemove}
        className="flex h-4 w-4 items-center justify-center rounded-full text-stone-500 hover:bg-rose-400/[0.15] hover:text-rose-300"
        aria-label={`${tag} 삭제`}
      >
        <X size={10} aria-hidden="true" />
      </button>
    </span>
  );
}

/** 인기 태그 추천 칩 — 클릭 시 onAdd, 이미 선택된 태그는 disabled. */
export function PopularTagChip({
  tag,
  onAdd,
  disabled,
}: {
  tag: string;
  onAdd: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={disabled}
      className={`rounded-full border px-2.5 py-1 font-mono text-[10.5px] transition-colors ${
        disabled
          ? "border-stone-800/60 bg-stone-900/30 text-stone-600"
          : "border-stone-700 bg-stone-900/40 text-stone-300 hover:border-sky-400/40 hover:text-sky-200"
      }`}
    >
      {tag}
    </button>
  );
}
