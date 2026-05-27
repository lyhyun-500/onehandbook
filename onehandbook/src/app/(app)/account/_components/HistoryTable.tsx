"use client";

import { useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

export interface HistoryTableColumn<T> {
  key: keyof T | string;
  label: string;
  align?: "left" | "right";
  width?: string;
}

export interface HistoryTableProps<T> {
  title: string;
  kicker?: string;
  subtitle?: string;
  columns: HistoryTableColumn<T>[];
  rows: T[];
  renderCell: (row: T, columnKey: string) => ReactNode;
  onClose: () => void;
  emptyMessage?: string;
}

export function HistoryTable<T extends { id: string | number }>({
  title,
  kicker,
  subtitle,
  columns,
  rows,
  renderCell,
  onClose,
  emptyMessage = "내역이 없습니다.",
}: HistoryTableProps<T>) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const end = Math.min(start + PAGE_SIZE, rows.length);
  const visible = rows.slice(start, end);
  const spacers = Math.max(0, PAGE_SIZE - visible.length);

  return (
    <section className="mt-3 rounded-lg border border-stone-800/60 bg-stone-900/30">
      <header className="flex items-start justify-between border-b border-stone-800/60 px-6 py-4">
        <div>
          {kicker && (
            <p className="text-[11px] uppercase tracking-widest text-sky-300/80">{kicker}</p>
          )}
          <h3 className="mt-1 font-serif text-xl text-stone-100">{title}</h3>
          {subtitle && <p className="mt-1 text-sm text-stone-400">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="rounded-md p-1 text-stone-400 transition hover:bg-stone-100/[0.04] hover:text-stone-200"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {rows.length === 0 ? (
        <div className="px-6 py-12 text-center text-sm text-stone-400">{emptyMessage}</div>
      ) : (
        <>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-800/60 text-[11px] uppercase tracking-widest text-stone-500">
                {columns.map((col) => (
                  <th
                    key={String(col.key)}
                    className={cn(
                      "px-6 py-3 font-normal",
                      col.align === "right" ? "text-right" : "text-left",
                    )}
                    style={col.width ? { width: col.width } : undefined}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr
                  key={String(row.id)}
                  className="border-b border-stone-800/40 last:border-b-0"
                >
                  {columns.map((col) => (
                    <td
                      key={String(col.key)}
                      className={cn(
                        "px-6 py-3 text-stone-300",
                        col.align === "right" ? "text-right tabular-nums" : "text-left",
                      )}
                    >
                      {renderCell(row, String(col.key))}
                    </td>
                  ))}
                </tr>
              ))}
              {Array.from({ length: spacers }).map((_, i) => (
                <tr key={`spacer-${i}`} className="border-b border-stone-800/40 last:border-b-0">
                  {columns.map((col) => (
                    <td key={String(col.key)} className="px-6 py-3">
                      &nbsp;
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <footer className="flex items-center justify-between border-t border-stone-800/60 px-6 py-3 text-[12px] text-stone-400">
              <span>
                {start + 1}–{end} / {rows.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-md p-1 transition hover:bg-stone-100/[0.04] hover:text-stone-200 disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label="이전 페이지"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    className={cn(
                      "h-6 min-w-6 rounded-md px-2 text-[12px] tabular-nums transition",
                      p === page
                        ? "bg-sky-400/10 text-sky-200 ring-1 ring-sky-400/30"
                        : "text-stone-400 hover:bg-stone-100/[0.04] hover:text-stone-200",
                    )}
                  >
                    {p}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded-md p-1 transition hover:bg-stone-100/[0.04] hover:text-stone-200 disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label="다음 페이지"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </footer>
          )}
        </>
      )}
    </section>
  );
}
