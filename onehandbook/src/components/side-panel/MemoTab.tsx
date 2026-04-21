"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const DEBOUNCE_MS = 1000;
const SUCCESS_HIDE_MS = 3000;

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: number }
  | { kind: "error"; message: string };

function formatRelativeSaved(at: number): string {
  const s = Math.round((Date.now() - at) / 1000);
  if (s < 5) return "방금 전";
  if (s < 60) return `${s}초 전`;
  const m = Math.floor(s / 60);
  return `${m}분 전`;
}

export function MemoTab({
  episodeId,
  episodeNumber,
}: {
  episodeId: number;
  episodeNumber: number;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [content, setContent] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const successHideRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef(content);

  contentRef.current = content;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { data, error } = await supabase
          .from("episode_memos")
          .select("content")
          .eq("episode_id", episodeId)
          .maybeSingle();

        if (cancelled) return;
        if (error) {
          console.error("[MemoTab] load memo", error);
          setSaveState({
            kind: "error",
            message: "메모를 불러오지 못했습니다.",
          });
          setLoaded(true);
          return;
        }
        setContent(typeof data?.content === "string" ? data.content : "");
      } catch (e) {
        console.error("[MemoTab] load memo", e);
        if (!cancelled) {
          setSaveState({
            kind: "error",
            message: "메모를 불러오지 못했습니다.",
          });
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [episodeId, supabase]);

  const persist = useCallback(async () => {
    const text = contentRef.current;
    setSaveState({ kind: "saving" });
    try {
      const { error } = await supabase.from("episode_memos").upsert(
        {
          episode_id: episodeId,
          content: text,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "episode_id" }
      );
      if (error) throw error;
      const at = Date.now();
      setSaveState({ kind: "saved", at });
      if (successHideRef.current) clearTimeout(successHideRef.current);
      successHideRef.current = setTimeout(() => {
        setSaveState((s) =>
          s.kind === "saved" && s.at === at ? { kind: "idle" } : s
        );
      }, SUCCESS_HIDE_MS);
    } catch (e: unknown) {
      console.error("[MemoTab] save", e);
      const message =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: string }).message)
          : "저장 실패";
      setSaveState({ kind: "error", message });
    }
  }, [episodeId, supabase]);

  const scheduleSave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      void persist();
    }, DEBOUNCE_MS);
  }, [persist]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (successHideRef.current) clearTimeout(successHideRef.current);
    };
  }, []);

  const onChange = (next: string) => {
    setContent(next);
    if (!loaded) return;
    scheduleSave();
  };

  let statusLine: string | null = null;
  if (saveState.kind === "saving") statusLine = "저장 중...";
  else if (saveState.kind === "saved")
    statusLine = `자동저장됨 · ${formatRelativeSaved(saveState.at)}`;
  else if (saveState.kind === "error") statusLine = `저장 실패: ${saveState.message}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <h3 className="shrink-0 text-sm font-medium text-zinc-300">
        회차 {episodeNumber} 메모
      </h3>
      <textarea
        value={content}
        onChange={(e) => onChange(e.target.value)}
        disabled={!loaded}
        placeholder="이 회차에 대한 메모를 자유롭게 적어보세요"
        className="min-h-[12rem] w-full flex-1 resize-y rounded-lg border border-zinc-700 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-600/50 focus:outline-none focus:ring-1 focus:ring-cyan-600/30 disabled:opacity-60"
      />
      {statusLine ? (
        <p
          className={`shrink-0 text-xs ${
            saveState.kind === "error" ? "text-red-400/90" : "text-zinc-500"
          }`}
        >
          {statusLine}
        </p>
      ) : (
        <p className="shrink-0 text-xs text-zinc-600">&nbsp;</p>
      )}
    </div>
  );
}
