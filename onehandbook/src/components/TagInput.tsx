"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TagChip, PopularTagChip } from "@/components/atoms/TagChip";

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
          { cache: "no-store" },
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

  const popularFiltered = popular
    .map((t) => ({ raw: t, prefix: t.startsWith("#") ? t : `#${t}` }))
    .filter(
      (t) =>
        !normalized.some(
          (x) => x.toLowerCase() === t.raw.toLowerCase().replace(/^#+/, ""),
        ),
    )
    .slice(0, 20);

  return (
    <div ref={rootRef} className="flex flex-col gap-3">
      {normalized.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {normalized.map((t) => (
            <TagChip
              key={t.toLowerCase()}
              tag={`#${t}`}
              onRemove={() => remove(t)}
            />
          ))}
        </div>
      )}

      <div className="relative">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
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
            className="flex-1 rounded-md border border-stone-800/80 bg-stone-900/60 px-4 py-2.5 font-serif text-[13.5px] text-stone-100 placeholder:text-stone-600 focus:border-sky-400/40 focus:outline-none"
          />
          <button
            type="button"
            onClick={addFromInput}
            className="rounded-md border border-stone-700 bg-stone-900/60 px-4 py-2.5 font-serif text-[13px] text-stone-200 hover:border-sky-400/40 hover:text-sky-200"
          >
            추가
          </button>
        </div>

        {open && (loading || suggestions.length > 0 || input.trim()) && (
          <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-md border border-stone-800 bg-stone-950/95 shadow-[0_18px_48px_-12px_rgba(0,0,0,0.7)] backdrop-blur">
            <div className="max-h-56 overflow-y-auto p-2">
              {loading && (
                <p className="px-2 py-2 font-mono text-[10px] uppercase tracking-widest text-stone-500">
                  검색 중…
                </p>
              )}
              {!loading && suggestions.length === 0 && normalizeTagToken(input) && (
                <button
                  type="button"
                  onClick={() => {
                    addTag(input);
                    setInput("");
                    setOpen(false);
                  }}
                  className="w-full rounded-md px-2 py-2 text-left font-serif text-[13px] text-stone-300 hover:bg-stone-900"
                >
                  새 태그 만들기:{" "}
                  <span className="font-mono text-sky-300">
                    #{normalizeTagToken(input)}
                  </span>
                </button>
              )}
              {suggestions
                .filter(
                  (s) => !normalized.some((t) => t.toLowerCase() === s.toLowerCase()),
                )
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
                    className="w-full rounded-md px-2 py-2 text-left font-serif text-[13px] text-stone-200 hover:bg-stone-900"
                  >
                    #{s}
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>

      {popularFiltered.length > 0 && (
        <div className="border-t border-stone-800/50 pt-4">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-stone-500">
            요즘 인기 태그
          </div>
          <div className="flex flex-wrap gap-1.5">
            {popularFiltered.map(({ raw, prefix }) => (
              <PopularTagChip
                key={raw.toLowerCase()}
                tag={prefix}
                onAdd={() => addTag(raw)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
