"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  CHARACTER_ROLES,
  emptyCharacter,
  type CharacterSetting,
  type WorldSetting,
} from "@/lib/works/loreTypes";

const GENRES = [
  "로맨스",
  "판타지",
  "현대",
  "무협",
  "스포츠",
  "미스터리",
  "SF",
  "일상",
  "기타",
];

const STATUSES = ["연재중", "완결", "휴재"] as const;

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

function TagInput({
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
    <div
      ref={rootRef}
      className="rounded-lg border border-zinc-700 bg-zinc-900/40 p-3"
    >
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
              {loading && (
                <p className="px-2 py-2 text-xs text-zinc-500">검색 중…</p>
              )}
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
                .filter(
                  (s) => !normalized.some((t) => t.toLowerCase() === s.toLowerCase())
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
              .filter(
                (t) => !normalized.some((x) => x.toLowerCase() === t.toLowerCase())
              )
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

export function WorkSettingsForm({
  workId,
  initialTitle,
  initialGenre,
  initialStatus,
  initialTags,
  initialWorld,
  initialCharacters,
}: {
  workId: number;
  initialTitle: string;
  initialGenre: string;
  initialStatus: string;
  initialTags: string[];
  initialWorld: WorldSetting;
  initialCharacters: CharacterSetting[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [genre, setGenre] = useState(initialGenre);
  const [status, setStatus] = useState<"연재중" | "완결" | "휴재">(
    initialStatus as "연재중" | "완결" | "휴재"
  );
  const [tags, setTags] = useState<string[]>(
    Array.isArray(initialTags) ? initialTags.filter((t) => typeof t === "string") : []
  );
  const [worldBackground, setWorldBackground] = useState(
    initialWorld.background
  );
  const [worldEra, setWorldEra] = useState(initialWorld.era);
  const [worldRules, setWorldRules] = useState(initialWorld.rules);
  const [characters, setCharacters] = useState<CharacterSetting[]>(
    initialCharacters.length > 0 ? initialCharacters : []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const tagsNormalized = useMemo(() => {
    const uniq = new Map<string, string>();
    for (const raw of tags) {
      const t = String(raw ?? "").trim();
      if (!t) continue;
      const noHash = t.replace(/^#+/, "").trim();
      if (!noHash) continue;
      const key = noHash.toLowerCase();
      if (!uniq.has(key)) uniq.set(key, noHash);
    }
    return [...uniq.values()].slice(0, 20);
  }, [tags]);

  const addCharacter = () => {
    setCharacters((prev) => [...prev, emptyCharacter()]);
  };

  const removeCharacter = (index: number) => {
    setCharacters((prev) => prev.filter((_, i) => i !== index));
  };

  const updateCharacter = (
    index: number,
    patch: Partial<CharacterSetting>
  ) => {
    setCharacters((prev) =>
      prev.map((c, i) => (i === index ? { ...c, ...patch } : c))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const world_setting: WorldSetting = {
      background: worldBackground.trim(),
      era: worldEra.trim(),
      rules: worldRules.trim(),
    };

    const character_settings = characters
      .filter((c) => c.name.trim())
      .map((c) => ({
        name: c.name.trim(),
        role: c.role.trim() || "주인공",
        personality: c.personality.trim(),
        abilities: c.abilities.trim(),
        goals: c.goals.trim(),
        relationships: c.relationships.trim(),
      }));

    try {
      const { error } = await supabase
        .from("works")
        .update({
          title,
          genre,
          status,
          tags: tagsNormalized,
          world_setting,
          character_settings,
        })
        .eq("id", workId);

      if (error) throw error;

      router.push(`/works/${workId}`);
      router.refresh();
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "저장에 실패했습니다. 다시 시도해주세요.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6"
    >
      <div className="space-y-10">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-zinc-100">기본 정보</h2>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">
              제목
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={200}
              placeholder="작품 제목"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">
              장르
            </label>
            <select
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-zinc-100 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              {GENRES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">
              연재 상태
            </label>
            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as "연재중" | "완결" | "휴재")
              }
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-zinc-100 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">
              태그
            </label>
            <p className="mb-2 text-sm text-zinc-500">
              엔터로 추가하고, 칩의 ×로 삭제합니다. 예: #회귀물 #먼치킨 #전문직
            </p>
            <TagInput value={tags} onChange={setTags} />
          </div>
        </div>

        <div className="space-y-4 border-t border-zinc-800 pt-8">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">
              세계관 설정
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              AI 분석 시 원고와 함께 전달됩니다. 배경·시대·규칙을 자유롭게
              적어 주세요.
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">
              배경
            </label>
            <textarea
              value={worldBackground}
              onChange={(e) => setWorldBackground(e.target.value)}
              rows={3}
              placeholder="지역, 무대, 세계의 큰 그림 등"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">
              시대
            </label>
            <textarea
              value={worldEra}
              onChange={(e) => setWorldEra(e.target.value)}
              rows={2}
              placeholder="현대, 조선, 다른 차원의 연도 체계 등"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">
              세계관 규칙
            </label>
            <textarea
              value={worldRules}
              onChange={(e) => setWorldRules(e.target.value)}
              rows={4}
              placeholder="마법, 시스템, 금지 사항, 사회 구조 등"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
        </div>

        <div className="space-y-4 border-t border-zinc-800 pt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">
                인물 설정
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                이름이 있는 행만 저장됩니다. 분석 시 캐릭터 일관성·관계 활용도에
                반영됩니다.
              </p>
            </div>
            <button
              type="button"
              onClick={addCharacter}
              className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
            >
              인물 추가
            </button>
          </div>

          {characters.length === 0 ? (
            <p className="text-sm text-zinc-500">
              등록된 인물이 없습니다. 「인물 추가」로 입력해 주세요.
            </p>
          ) : (
            <div className="space-y-6">
              {characters.map((c, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-zinc-400">
                      인물 {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeCharacter(index)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      삭제
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-1">
                      <label className="mb-1 block text-xs text-zinc-500">
                        이름
                      </label>
                      <input
                        type="text"
                        value={c.name}
                        onChange={(e) =>
                          updateCharacter(index, { name: e.target.value })
                        }
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <label className="mb-1 block text-xs text-zinc-500">
                        역할
                      </label>
                      <select
                        value={
                          CHARACTER_ROLES.some((r) => r === c.role)
                            ? c.role
                            : "주인공"
                        }
                        onChange={(e) =>
                          updateCharacter(index, { role: e.target.value })
                        }
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
                      >
                        {CHARACTER_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs text-zinc-500">
                        성격
                      </label>
                      <textarea
                        value={c.personality}
                        onChange={(e) =>
                          updateCharacter(index, { personality: e.target.value })
                        }
                        rows={2}
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs text-zinc-500">
                        능력
                      </label>
                      <textarea
                        value={c.abilities}
                        onChange={(e) =>
                          updateCharacter(index, { abilities: e.target.value })
                        }
                        rows={2}
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs text-zinc-500">
                        목표
                      </label>
                      <textarea
                        value={c.goals}
                        onChange={(e) =>
                          updateCharacter(index, { goals: e.target.value })
                        }
                        rows={2}
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs text-zinc-500">
                        인물 간 관계
                      </label>
                      <textarea
                        value={c.relationships}
                        onChange={(e) =>
                          updateCharacter(index, {
                            relationships: e.target.value,
                          })
                        }
                        rows={2}
                        placeholder="타 인물과의 관계, 갈등 구조 등"
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        <div className="flex gap-3 border-t border-zinc-800 pt-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-zinc-700 px-6 py-2.5 text-zinc-300 transition-colors hover:bg-zinc-800"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-amber-600 px-6 py-2.5 font-medium text-white transition-colors hover:bg-amber-500 disabled:opacity-50"
          >
            {loading ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </form>
  );
}
