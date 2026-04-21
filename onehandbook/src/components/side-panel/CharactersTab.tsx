"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { CHARACTER_ROLES } from "@/lib/works/loreTypes";
import type { Character, CharacterSettings, CharacterWithKey } from "./types";
import {
  charactersEqual,
  emptyCharacterRow,
  makeCharactersWithKeys,
  stripCharacterKey,
} from "./characterModel";
import { DeleteConfirmModal } from "./DeleteConfirmModal";

const MESSAGE_HIDE_MS = 3000;

type CardStatus = "clean" | "dirty" | "invalid";

function getCardStatus(
  current: CharacterWithKey,
  initial: Character | undefined
): CardStatus {
  if (!current.name.trim()) return "invalid";
  if (initial === undefined) return "dirty";
  const changed =
    current.name !== (initial.name ?? "") ||
    (current.role ?? "") !== (initial.role ?? "") ||
    (current.goals ?? "") !== (initial.goals ?? "") ||
    (current.abilities ?? "") !== (initial.abilities ?? "") ||
    (current.personality ?? "") !== (initial.personality ?? "") ||
    (current.relationships ?? "") !== (initial.relationships ?? "");
  return changed ? "dirty" : "clean";
}

function cardBorderClass(status: CardStatus): string {
  if (status === "dirty") return "border-blue-500";
  if (status === "invalid") return "border-yellow-500";
  return "border-zinc-700";
}

export function CharactersTab({
  workId,
  characterSettings,
  onDirtyChange,
}: {
  workId: number;
  characterSettings: CharacterSettings;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [characters, setCharacters] = useState<CharacterWithKey[]>(() =>
    makeCharactersWithKeys(characterSettings)
  );
  const initialByKey = useRef<Map<string, Character>>(new Map());

  useLayoutEffect(() => {
    initialByKey.current.clear();
    characters.forEach((c) =>
      initialByKey.current.set(c._key, stripCharacterKey(c))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 최초 마운트 시 스냅샷만
  }, []);

  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState(false);
  const messageHideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<{
    _key: string;
    label: string;
  } | null>(null);

  const getInitial = useCallback(
    (key: string) => initialByKey.current.get(key),
    []
  );

  const hasPendingChanges = useMemo(
    () =>
      characters.some((c) => {
        const ini = getInitial(c._key);
        return getCardStatus(c, ini) !== "clean";
      }),
    [characters, getInitial]
  );

  useEffect(() => {
    onDirtyChange?.(hasPendingChanges);
  }, [hasPendingChanges, onDirtyChange]);

  useEffect(() => {
    return () => {
      if (messageHideRef.current) clearTimeout(messageHideRef.current);
    };
  }, []);

  const scheduleClearMessage = useCallback(() => {
    if (messageHideRef.current) clearTimeout(messageHideRef.current);
    messageHideRef.current = setTimeout(() => {
      setSaveMessage("");
      setSaveError(false);
    }, MESSAGE_HIDE_MS);
  }, []);

  const commitList = useCallback(
    async (list: CharacterWithKey[]) => {
      const validCharacters = list.filter((c) => c.name.trim().length > 0);
      const invalidCount = list.length - validCharacters.length;

      setSaving(true);
      setSaveError(false);
      setSaveMessage("");
      try {
        const payload = validCharacters.map(stripCharacterKey);
        const { error } = await supabase
          .from("works")
          .update({ character_settings: payload })
          .eq("id", workId);
        if (error) throw error;

        validCharacters.forEach((c) => {
          initialByKey.current.set(c._key, stripCharacterKey(c));
        });

        setCharacters((prev) => [...prev]);

        if (invalidCount === 0) {
          setSaveMessage(`${validCharacters.length}개 저장됨`);
        } else {
          setSaveMessage(
            `${validCharacters.length}개 저장됨, ${invalidCount}개 미완성 (이름 필요)`
          );
        }
        scheduleClearMessage();
      } catch (e: unknown) {
        console.error("[CharactersTab] commitList", e);
        setSaveError(true);
        setSaveMessage("저장 실패. 다시 시도해주세요.");
      } finally {
        setSaving(false);
      }
    },
    [supabase, workId, scheduleClearMessage]
  );

  const handleSaveAll = useCallback(() => {
    void commitList(characters);
  }, [characters, commitList]);

  const toggleExpand = (key: string) => {
    setExpandedKey((prev) => (prev === key ? null : key));
  };

  const patchCard = (key: string, patch: Partial<CharacterWithKey>) => {
    setCharacters((prev) =>
      prev.map((c) => (c._key === key ? { ...c, ...patch } : c))
    );
  };

  const handleAdd = () => {
    const row = emptyCharacterRow();
    setCharacters((prev) => [...prev, row]);
    setExpandedKey(row._key);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const k = deleteTarget._key;
    const next = characters.filter((c) => c._key !== k);
    initialByKey.current.delete(k);
    setDeleteTarget(null);
    setExpandedKey((exp) => (exp === k ? null : exp));
    setCharacters(next);

    if (next.length === 0) {
      setSaving(true);
      setSaveError(false);
      setSaveMessage("");
      try {
        const { error } = await supabase
          .from("works")
          .update({ character_settings: [] })
          .eq("id", workId);
        if (error) throw error;
        initialByKey.current.clear();
        setSaveMessage("저장됨 (인물 0명)");
        scheduleClearMessage();
      } catch (e) {
        console.error("[CharactersTab] delete all", e);
        setSaveError(true);
        setSaveMessage("저장 실패. 다시 시도해주세요.");
      } finally {
        setSaving(false);
      }
      return;
    }
    await commitList(next);
  };

  const inputClass =
    "w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500";
  const textareaClass = `${inputClass} resize-y min-h-[4rem]`;

  if (characters.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <p className="text-sm text-zinc-500">등록된 인물이 없습니다</p>
        <button
          type="button"
          onClick={handleAdd}
          className="self-start rounded-lg border border-zinc-600 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
        >
          + 인물 추가
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <h2 className="text-sm font-semibold text-zinc-200">인물</h2>
      <ul className="space-y-3">
        {characters.map((c) => {
          const initial = getInitial(c._key);
          const status = getCardStatus(c, initial);
          const open = expandedKey === c._key;
          const label = c.name.trim() || "(이름 없음)";
          const sub = c.role?.trim() ? ` · ${c.role}` : "";
          const border = cardBorderClass(status);

          return (
            <li
              key={c._key}
              className={`overflow-hidden rounded-lg border bg-zinc-800/50 ${border}`}
            >
              <div className="flex items-center gap-2 px-3 py-2">
                <button
                  type="button"
                  onClick={() => toggleExpand(c._key)}
                  className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left text-sm text-zinc-200"
                >
                  <span className="min-w-0 truncate">
                    <span className="text-zinc-500">{open ? "▼" : "▶"}</span>{" "}
                    <span className="font-medium">{label}</span>
                    <span className="text-zinc-500">{sub}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-0.5">
                    {status === "dirty" ? (
                      <span className="text-xs text-blue-400">수정됨</span>
                    ) : null}
                    {status === "invalid" ? (
                      <span className="text-xs text-yellow-400">이름 필요</span>
                    ) : null}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setDeleteTarget({
                      _key: c._key,
                      label,
                    })
                  }
                  className="shrink-0 rounded border border-red-500/30 px-2 py-1 text-xs text-red-300 hover:bg-red-950/40"
                >
                  🗑 삭제
                </button>
              </div>

              {open && (
                <div className="space-y-3 border-t border-zinc-800/80 px-3 py-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-zinc-500">
                      이름
                    </label>
                    <input
                      type="text"
                      value={c.name}
                      onChange={(e) =>
                        patchCard(c._key, { name: e.target.value })
                      }
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-zinc-500">
                      역할
                    </label>
                    <select
                      value={
                        CHARACTER_ROLES.some((r) => r === (c.role ?? ""))
                          ? (c.role ?? "")
                          : "주인공"
                      }
                      onChange={(e) => patchCard(c._key, { role: e.target.value })}
                      className={inputClass}
                    >
                      {CHARACTER_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-zinc-500">
                      목표
                    </label>
                    <textarea
                      value={c.goals ?? ""}
                      onChange={(e) =>
                        patchCard(c._key, { goals: e.target.value })
                      }
                      rows={4}
                      className={textareaClass}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-zinc-500">
                      능력
                    </label>
                    <textarea
                      value={c.abilities ?? ""}
                      onChange={(e) =>
                        patchCard(c._key, { abilities: e.target.value })
                      }
                      rows={4}
                      className={textareaClass}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-zinc-500">
                      성격
                    </label>
                    <textarea
                      value={c.personality ?? ""}
                      onChange={(e) =>
                        patchCard(c._key, { personality: e.target.value })
                      }
                      rows={4}
                      className={textareaClass}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-zinc-500">
                      관계
                    </label>
                    <textarea
                      value={c.relationships ?? ""}
                      onChange={(e) =>
                        patchCard(c._key, { relationships: e.target.value })
                      }
                      rows={4}
                      className={textareaClass}
                    />
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={handleAdd}
        className="rounded-lg border border-dashed border-zinc-600 py-2 text-sm text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
      >
        + 인물 추가
      </button>

      <div className="border-t border-zinc-800 pt-4">
        <button
          type="button"
          disabled={saving || !hasPendingChanges}
          onClick={handleSaveAll}
          className="w-full rounded-lg border border-cyan-600/50 bg-cyan-950/40 px-4 py-2.5 text-sm font-medium text-cyan-100 transition-colors hover:bg-cyan-950/60 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? "저장 중..." : "전체 저장"}
        </button>
        {saveMessage ? (
          <p
            className={`mt-2 text-sm ${
              saveError ? "text-red-400/90" : "text-zinc-400"
            }`}
          >
            {saveMessage}
          </p>
        ) : null}
      </div>

      <DeleteConfirmModal
        open={deleteTarget !== null}
        title="인물 삭제"
        message={
          deleteTarget
            ? `정말 ${deleteTarget.label}을(를) 삭제하시겠습니까?`
            : ""
        }
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
