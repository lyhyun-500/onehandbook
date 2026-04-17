"use client";

import { useEffect, useMemo, useRef, useState } from "react";

function normalizeTagToken(raw: string): string {
  const t = String(raw ?? "").trim();
  if (!t) return "";
  return t.replace(/^#+/, "").trim();
}

function uniqTags(tags: string[], cap: number = 20): string[] {
  const uniq = new Map<string, string>();
  for (const raw of tags) {
    const noHash = normalizeTagToken(raw);
    if (!noHash) continue;
    const key = noHash.toLowerCase();
    if (!uniq.has(key)) uniq.set(key, noHash);
  }
  return [...uniq.values()].slice(0, cap);
}

export function TagInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [popular, setPopular] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const lastQueryRef = useRef("");

  const normalized = useMemo(() => uniqTags(value, 20), [value]);

  const remove = (tag: string) => {
    const key = tag.toLowerCase();
    onChange(normalized.filter((t) => t.toLowerCase() !== key));
  };

  const addTag = (raw: string) => {
    const noHash = normalizeTagToken(raw);
    if (!noHash) return;
    if (normalized.some((t) => t.toLowerCase() === noHash.toLowerCase())) return;
    onChange([...normalized, noHash].slice(0, 20));
  };

  const addFromInput = () => {
    const raw = input.trim();
    if (!raw) return;
    const parts = raw
      .split(/[\n,]/g)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const p of parts) addTag(p);
    setInput("");
    setOpen(false);
  };

  useEffect(() => {
    let cancelled = false;
    async function loadPopular() {
      try {
        const res = await fetch("/api/tags/popular?limit=20", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { tags?: string[] };
        if (cancelled) return;
        setPopular(Array.isArray(data.tags) ? data.tags : []);
      } catch {
        /* ignore */
      }
    }
    void loadPopular();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const q = normalizeTagToken(input);
    if (!q) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    lastQueryRef.current = q;
    setLoading(true);
    const id = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/tags/search?q=${encodeURIComponent(q)}&limit=12`,
          { cache: "no-store" }
        );
        const data = (await res.json().catch(() => ({}))) as { tags?: string[] };
        if (lastQueryRef.current !== q) return;
        setSuggestions(Array.isArray(data.tags) ? data.tags : []);
      } catch {
        if (lastQueryRef.current === q) setSuggestions([]);
      } finally {
        if (lastQueryRef.current === q) setLoading(false);
      }
    }, 180);
    return () => window.clearTimeout(id);
  }, [input]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={rootRef} className="rounded-lg border border-zinc-700 bg-zinc-900/40 p-3">
      <div className="flex flex-wrap gap-2">
        {normalized.map((t) => (
          <span
            key={t.toLowerCase()}
            className="inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-sm text-zinc-100"
          >
            <span className="text-zinc-300">#{t}</span>
            <button
              type="button"
              onClick={() => remove(t)}
              className="rounded-full px-1 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
              aria-label={`${t} 태그 삭제`}
            >
              ×
            </button>
          </span>
        ))}
      </div>

      <div className="relative mt-3">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              // 한글 IME 조합 중 Enter 처리 시 마지막 글자 중복 입력 방지
              if (e.nativeEvent.isComposing) return;
              if (e.key === "Enter") {
                e.preventDefault();
                addFromInput();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setOpen(false);
              }
              if (e.key === "Backspace" && !input && normalized.length > 0) {
                e.preventDefault();
                remove(normalized[normalized.length - 1]!);
              }
            }}
            placeholder="태그 입력 후 Enter (예: #회귀물)"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
          <button
            type="button"
            onClick={addFromInput}
            className="shrink-0 rounded-lg border border-zinc-600 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
          >
            추가
          </button>
        </div>

        {open && (loading || suggestions.length > 0 || input.trim()) && (
          <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/40">
            <div className="max-h-56 overflow-y-auto p-2">
              {loading && <p className="px-2 py-2 text-xs text-zinc-500">검색 중…</p>}
              {!loading && suggestions.length === 0 && normalizeTagToken(input) && (
                <button
                  type="button"
                  onClick={() => {
                    addTag(input);
                    setInput("");
                    setOpen(false);
                  }}
                  className="w-full rounded-lg px-2 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-900"
                >
                  새 태그 만들기:{" "}
                  <span className="font-semibold text-cyan-300">
                    #{normalizeTagToken(input)}
                  </span>
                </button>
              )}
              {suggestions
                .filter((s) => !normalized.some((t) => t.toLowerCase() === s.toLowerCase()))
                .slice(0, 12)
                .map((s) => (
                  <button
                    key={s.toLowerCase()}
                    type="button"
                    onClick={() => {
                      addTag(s);
                      setInput("");
                      setOpen(false);
                    }}
                    className="w-full rounded-lg px-2 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-900"
                  >
                    #{s}
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>

      {popular.length > 0 && (
        <div className="mt-4 border-t border-zinc-800/70 pt-3">
          <p className="mb-2 text-xs font-medium text-zinc-500">요즘 인기 있는 태그</p>
          <div className="flex flex-wrap gap-2">
            {popular
              .filter((t) => !normalized.some((x) => x.toLowerCase() === t.toLowerCase()))
              .slice(0, 20)
              .map((t) => (
                <button
                  key={t.toLowerCase()}
                  type="button"
                  onClick={() => addTag(t)}
                  className="rounded-full border border-zinc-700 bg-zinc-950/40 px-2.5 py-1 text-xs text-zinc-200 hover:bg-zinc-900"
                >
                  #{t}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

