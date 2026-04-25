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
import type { Character, CharacterSettings, CharacterWithKey } from "./types";
import { emptyCharacterRow, makeCharactersWithKeys, stripCharacterKey } from "./characterModel";
import { DeleteConfirmModal } from "./DeleteConfirmModal";
import { CharacterCard } from "./CharacterCard";

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
    (current.summary ?? "") !== (initial.summary ?? "") ||
    (current.role ?? "") !== (initial.role ?? "") ||
    (current.goals ?? "") !== (initial.goals ?? "") ||
    (current.abilities ?? "") !== (initial.abilities ?? "") ||
    (current.personality ?? "") !== (initial.personality ?? "") ||
    (current.relationships ?? "") !== (initial.relationships ?? "");
  return changed ? "dirty" : "clean";
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

  if (characters.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <p className="text-sm" style={{ color: "var(--color-sidepanel-text-secondary)" }}>
          등록된 인물이 없습니다
        </p>
        <button
          type="button"
          onClick={handleAdd}
          className="self-start rounded-lg border px-3 py-2 text-sm"
          style={{
            borderColor: "var(--color-sidepanel-border-subtle)",
            color: "var(--color-sidepanel-text-primary)",
            background: "var(--color-sidepanel-bg)",
          }}
        >
          + 인물 추가
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <h2
        className="text-sm font-semibold"
        style={{ color: "var(--color-sidepanel-text-primary)" }}
      >
        인물
      </h2>
      <ul className="space-y-3">
        {characters.map((c) => {
          const initial = getInitial(c._key);
          const status = getCardStatus(c, initial);
          const open = expandedKey === c._key;
          const label = c.name.trim() || "(이름 없음)";

          return (
            <CharacterCard
              key={c._key}
              card={c}
              status={status}
              open={open}
              onToggle={() => toggleExpand(c._key)}
              onPatch={(patch) => patchCard(c._key, patch)}
              onRequestDelete={() =>
                setDeleteTarget({
                  _key: c._key,
                  label,
                })
              }
            />
          );
        })}
      </ul>

      <button
        type="button"
        onClick={handleAdd}
        className="rounded-lg border border-dashed py-2 text-sm"
        style={{
          borderColor: "var(--color-sidepanel-border-subtle)",
          color: "var(--color-sidepanel-text-secondary)",
        }}
      >
        + 인물 추가
      </button>

      <div
        className="border-t pt-4"
        style={{ borderColor: "var(--color-sidepanel-border-subtle)" }}
      >
        <button
          type="button"
          disabled={saving || !hasPendingChanges}
          onClick={handleSaveAll}
          className="w-full rounded-lg border px-4 py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            borderColor: "color-mix(in srgb, var(--color-sidepanel-accent) 55%, transparent)",
            background: "color-mix(in srgb, var(--color-sidepanel-accent) 18%, var(--color-sidepanel-bg))",
            color: "var(--color-sidepanel-text-primary)",
          }}
        >
          {saving ? "저장 중..." : "전체 저장"}
        </button>
        {saveMessage ? (
          <p
            className="mt-2 text-sm"
            style={{
              color: saveError
                ? "var(--color-sidepanel-border-invalid)"
                : "var(--color-sidepanel-text-secondary)",
            }}
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
