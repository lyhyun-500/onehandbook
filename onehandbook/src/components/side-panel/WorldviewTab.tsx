"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { WorldSetting } from "./types";

const SUCCESS_HIDE_MS = 3000;

function normalizeWorld(w: WorldSetting) {
  return {
    era: w?.era ?? "",
    rules: w?.rules ?? "",
    background: w?.background ?? "",
  };
}

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: number }
  | { kind: "error"; message: string };

export function WorldviewTab({
  workId,
  worldSetting,
  onDirtyChange,
}: {
  workId: number;
  worldSetting: WorldSetting;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const initialRef = useRef(normalizeWorld(worldSetting));
  const [era, setEra] = useState(initialRef.current.era);
  const [rules, setRules] = useState(initialRef.current.rules);
  const [background, setBackground] = useState(initialRef.current.background);
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });
  const successHideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasUnsavedChanges = useMemo(() => {
    const cur = { era, rules, background };
    const ini = initialRef.current;
    return (
      cur.era !== ini.era ||
      cur.rules !== ini.rules ||
      cur.background !== ini.background
    );
  }, [era, rules, background]);

  useEffect(() => {
    onDirtyChange?.(hasUnsavedChanges);
  }, [hasUnsavedChanges, onDirtyChange]);

  useEffect(() => {
    return () => {
      if (successHideRef.current) clearTimeout(successHideRef.current);
    };
  }, []);

  const handleSave = useCallback(async () => {
    setSaveState({ kind: "saving" });
    try {
      const payload = {
        era: era.trim() || undefined,
        rules: rules.trim() || undefined,
        background: background.trim() || undefined,
      };
      const { error } = await supabase
        .from("works")
        .update({
          world_setting: payload,
        })
        .eq("id", workId);

      if (error) throw error;

      initialRef.current = {
        era: era,
        rules: rules,
        background: background,
      };
      const at = Date.now();
      setSaveState({ kind: "saved", at });
      if (successHideRef.current) clearTimeout(successHideRef.current);
      successHideRef.current = setTimeout(() => {
        setSaveState((s) =>
          s.kind === "saved" && s.at === at ? { kind: "idle" } : s
        );
      }, SUCCESS_HIDE_MS);
    } catch (e: unknown) {
      console.error("[WorldviewTab] save", e);
      const message =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: string }).message)
          : "저장 실패";
      setSaveState({ kind: "error", message });
    }
  }, [supabase, workId, era, rules, background]);

  const inputClass =
    "w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500";
  const textareaClass = `${inputClass} resize-y min-h-[5rem]`;

  let statusLine: string | null = null;
  if (saveState.kind === "saving") statusLine = "저장 중...";
  else if (saveState.kind === "saved") statusLine = "저장됨 · 방금 전";
  else if (saveState.kind === "error") statusLine = `저장 실패: ${saveState.message}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <h2 className="text-sm font-semibold text-zinc-200">세계관</h2>

      <div className="space-y-1">
        <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          시대 배경
        </label>
        <input
          type="text"
          value={era}
          onChange={(e) => setEra(e.target.value)}
          className={inputClass}
          placeholder="시대·배경을 입력하세요"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          규칙
        </label>
        <textarea
          value={rules}
          onChange={(e) => setRules(e.target.value)}
          rows={4}
          className={textareaClass}
          placeholder="마법·설정 규칙 등"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          배경
        </label>
        <textarea
          value={background}
          onChange={(e) => setBackground(e.target.value)}
          rows={4}
          className={textareaClass}
          placeholder="세계관 배경 설명"
        />
      </div>

      <div className="border-t border-zinc-800 pt-4">
        <button
          type="button"
          disabled={!hasUnsavedChanges || saveState.kind === "saving"}
          onClick={() => void handleSave()}
          className="rounded-lg border border-cyan-600/50 bg-cyan-950/40 px-4 py-2 text-sm font-medium text-cyan-100 transition-colors hover:bg-cyan-950/60 disabled:cursor-not-allowed disabled:opacity-40"
        >
          저장
        </button>
        {statusLine ? (
          <p
            className={`mt-2 text-xs ${
              saveState.kind === "error" ? "text-red-400/90" : "text-zinc-500"
            }`}
          >
            {statusLine}
          </p>
        ) : null}
      </div>
    </div>
  );
}
