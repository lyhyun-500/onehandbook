"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, ChevronRight, PanelRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  EPISODE_CONTENT_MAX_CHARS,
  EPISODE_CONTENT_MAX_LABEL,
  applyEpisodeContentChange,
  countEpisodeContentChars,
  isEpisodeContentWithinLimit,
} from "@/lib/episodeContentLimit";
import {
  UNSAVED_CHANGES_CONFIRM_MESSAGE,
  useAnalysisNavigationGuard,
} from "@/hooks/useAnalysisNavigationGuard";
import { md5Hex } from "@/lib/contentHash";
import { SettingsDrawer } from "@/components/episode-edit/SettingsDrawer";
import type {
  CharacterSettings,
  WorldSetting,
} from "@/components/side-panel/types";

interface EpisodeEditFormProps {
  /** 단계 D-fixup-3 (결정 53 옵션 U-1): mode 분기 — 편집 / 새 회차 등록. */
  mode: "new" | "edit";
  /** ADR-0031: 'prologue' 시 episode_type 인입 사양 (mode === 'new' 단독 의미). */
  type?: "episode" | "prologue";
  workId: number;
  workTitle: string;
  episodeNumber: number;
  initialWorld: WorldSetting;
  initialCharacters: CharacterSettings;
  /** mode === "edit" 시 필수, "new" 시 부재. */
  episodeId?: number;
  initialTitle?: string;
  initialContent?: string;
}

/**
 * 회차 편집 + 새 회차 등록 통합 client — 시안 episode-edit.jsx EpisodeEditScreen 정합.
 *
 * 풀폭 에디터(max-w-1100) + floating `설정` 버튼(panelRight) → SettingsDrawer 호출.
 * 통합 저장은 SettingsDrawer 가 책임 (D-16). 본 form 은 회차 본문 저장만.
 *
 * 단계 D-fixup-3 (결정 53 옵션 U-1):
 * - mode === "edit": 기존 사양 정합 (episodes.update + redirect /works/[id])
 * - mode === "new": episodes.insert + works.total_episodes 갱신 + redirect /works/[id]/episodes/[insertedId]/edit
 *   (SettingsDrawer 사용 사양 = 등록 후 편집 page 진입에서 정합)
 */
export function EpisodeEditForm({
  mode,
  type = "episode",
  workId,
  workTitle,
  episodeId,
  episodeNumber,
  initialTitle,
  initialContent,
  initialWorld,
  initialCharacters,
}: EpisodeEditFormProps) {
  const isEdit = mode === "edit";
  const isPrologue = type === "prologue";
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle ?? "");
  const [content, setContent] = useState(initialContent ?? "");
  // M3 C4 — 저장 baseline. 저장 성공 시 갱신 → bodyDirty=false 떨굼 사양.
  const [savedTitle, setSavedTitle] = useState(initialTitle ?? "");
  const [savedContent, setSavedContent] = useState(initialContent ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerUnsaved, setDrawerUnsaved] = useState(false);
  const [toast, setToast] = useState<{
    kind: "ok" | "err";
    message: string;
  } | null>(null);

  const supabase = createClient();

  const charCount = countEpisodeContentChars(content);
  const overLimit = !isEpisodeContentWithinLimit(content);
  const nearLimit =
    !overLimit && charCount >= EPISODE_CONTENT_MAX_CHARS * 0.9;
  const bodyDirty = title !== savedTitle || content !== savedContent;
  const totalUnsaved = bodyDirty || drawerUnsaved;

  function pushToast(kind: "ok" | "err", message: string) {
    setToast({ kind, message });
    window.setTimeout(() => setToast(null), 4200);
  }

  // M3 C3 — 폼 dirty 안 이탈 가드 (beforeunload + 내부 link + popstate).
  useAnalysisNavigationGuard(totalUnsaved, UNSAVED_CHANGES_CONFIRM_MESSAGE);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!isEpisodeContentWithinLimit(content)) {
      setError(
        `본문은 회차당 ${EPISODE_CONTENT_MAX_LABEL}(${EPISODE_CONTENT_MAX_CHARS.toLocaleString()}자)까지 등록할 수 있습니다.`,
      );
      setLoading(false);
      return;
    }

    try {
      if (isEdit && episodeId != null) {
        const { error: updateError } = await supabase
          .from("episodes")
          .update({ title, content, content_hash: md5Hex(content) })
          .eq("id", episodeId);
        if (updateError) throw updateError;
        // M3 C4 — 에디터 유지 사양: dirty baseline 갱신 + 저장 토스트.
        setSavedTitle(title);
        setSavedContent(content);
        pushToast("ok", "저장되었습니다");
      } else {
        // 단계 D-fixup-3 (결정 53 옵션 U-1): 새 회차 등록 → episodeId 받음 →
        // /edit page redirect (SettingsDrawer 사용 사양 정합).
        const { data: ins, error: insertError } = await supabase
          .from("episodes")
          .insert({
            work_id: workId,
            episode_number: episodeNumber,
            episode_type: isPrologue ? "prologue" : "episode",
            title,
            content,
            content_hash: md5Hex(content),
          })
          .select("id")
          .single();
        if (insertError || !ins) {
          throw insertError ?? new Error("등록 실패");
        }
        // works.total_episodes 갱신 (기존 사양 정합)
        const { count } = await supabase
          .from("episodes")
          .select("id", { count: "exact", head: true })
          .eq("work_id", workId);
        await supabase
          .from("works")
          .update({ total_episodes: count ?? episodeNumber })
          .eq("id", workId);
        // history 안 /new 잔재 제거 사양 (router.replace) — 뒤로가기 시 빈 폼 안 미도달 정합.
        router.replace(
          `/works/${workId}/episodes/${ins.id as number}/edit`,
        );
      }
    } catch (err: unknown) {
      // ADR-0031 — partial unique index (one_prologue_per_work) 안 23505 catch 사양.
      const code = (err as { code?: string })?.code;
      if (code === "23505" && isPrologue) {
        setError("이미 프롤로그가 있습니다. 작품당 1개만 등록할 수 있습니다.");
        setLoading(false);
        return;
      }
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : isEdit
            ? "수정에 실패했습니다. 다시 시도해주세요."
            : "등록에 실패했습니다. 다시 시도해주세요.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="relative mx-auto flex max-w-[1100px] flex-col gap-6 px-8 py-8"
      >
        <header className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.3em] text-sky-300/70">
              {isEdit ? "회차 편집" : "새 회차 등록"}
            </div>
            <div className="mt-1.5 flex items-center gap-2 text-[12.5px] text-stone-400">
              <Link
                href={`/works/${workId}`}
                className="text-stone-300 hover:text-sky-200"
              >
                {workTitle}
              </Link>
              <ChevronRight
                size={10}
                aria-hidden="true"
                className="text-stone-600"
              />
              <span className="font-mono tabular-nums">
                {episodeNumber === 0 ? "프롤로그" : `${episodeNumber}화`}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="group relative flex items-center gap-2 rounded-md border border-stone-700 bg-stone-900/70 px-3 py-2 text-[12px] text-stone-200 backdrop-blur transition-colors hover:border-sky-400/40 hover:bg-sky-400/[0.08] hover:text-sky-200"
            aria-label="설정 패널 열기"
            title={
              isEdit
                ? "세계관·인물·메모 설정"
                : "세계관·인물 설정 (메모는 회차 등록 후 사용 가능)"
            }
          >
            <PanelRight
              size={13}
              aria-hidden="true"
              className="text-stone-400 group-hover:text-sky-300"
            />
            <span className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-stone-500 group-hover:text-sky-300/80">
              설정
            </span>
            <span className="font-serif text-[12.5px]">
              {isEdit ? "세계관·인물·메모" : "세계관·인물"}
            </span>
            {drawerUnsaved && (
              <span className="absolute right-2.5 top-2 flex h-1.5 w-1.5">
                <span className="absolute inset-0 animate-ping rounded-full bg-amber-400/60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-400" />
              </span>
            )}
          </button>
        </header>

        <div className="flex flex-col gap-2">
          <label className="font-mono text-[10.5px] uppercase tracking-[0.25em] text-stone-500">
            회차 제목
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={200}
            placeholder="회차 제목을 입력하세요"
            className="w-full rounded-md border border-stone-800/80 bg-stone-900/40 px-4 py-3 font-serif text-[18px] text-stone-100 placeholder:text-stone-600 focus:border-sky-400/40 focus:outline-none"
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-end justify-between">
            <div>
              <label className="font-mono text-[10.5px] uppercase tracking-[0.25em] text-stone-500">
                본문
              </label>
              <p className="mt-1 text-[11px] text-stone-500">
                회차당 {EPISODE_CONTENT_MAX_LABEL} 제한입니다.
              </p>
            </div>
            <div
              className={`font-mono text-[12px] tabular-nums ${
                overLimit
                  ? "text-rose-300"
                  : nearLimit
                    ? "text-amber-300"
                    : "text-stone-400"
              }`}
            >
              <span
                className={
                  overLimit
                    ? "text-rose-300"
                    : nearLimit
                      ? "text-amber-300"
                      : "text-stone-200"
                }
              >
                {charCount.toLocaleString("ko-KR")}
              </span>
              <span className="mx-1 text-stone-600">/</span>
              <span>
                {EPISODE_CONTENT_MAX_CHARS.toLocaleString("ko-KR")}자
              </span>
            </div>
          </div>
          {overLimit && (
            <p className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              본문이 {EPISODE_CONTENT_MAX_LABEL}를 초과했습니다. 저장하려면{" "}
              {EPISODE_CONTENT_MAX_CHARS.toLocaleString("ko-KR")}자 이하로 줄여
              주세요.
            </p>
          )}
          <textarea
            value={content}
            onChange={(e) =>
              setContent((prev) => applyEpisodeContentChange(prev, e.target.value))
            }
            required
            placeholder="이번 회차의 본문을 작성하세요…"
            rows={24}
            className="w-full resize-y rounded-md border border-stone-800/80 bg-stone-900/40 px-6 py-5 font-serif text-[15px] leading-[1.95] text-stone-200 placeholder:text-stone-600 focus:border-sky-400/40 focus:outline-none"
            style={{ textWrap: "pretty", minHeight: 520 }}
          />
        </div>

        {error && (
          <p className="rounded-md border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {error}
          </p>
        )}

        <footer className="mt-2 flex items-center justify-between gap-3 border-t border-stone-800/60 pt-5">
          <div className="font-mono text-[10.5px] tracking-wide">
            {totalUnsaved ? (
              <span className="text-amber-300/85">· 미저장 변경 있음</span>
            ) : (
              <span className="text-stone-600">· 모든 변경 사항 저장됨</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (
                  totalUnsaved &&
                  !window.confirm(UNSAVED_CHANGES_CONFIRM_MESSAGE)
                ) {
                  return;
                }
                router.push(`/works/${workId}`);
              }}
              className="rounded-md border border-stone-800/80 bg-stone-900/40 px-4 py-2 text-[12.5px] text-stone-300 hover:border-stone-700 hover:text-stone-100"
            >
              회차 목록
            </button>
            <button
              type="submit"
              disabled={loading || overLimit}
              className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-5 py-2 text-[13px] font-medium text-stone-950 hover:bg-amber-400 disabled:opacity-50"
              style={{
                boxShadow:
                  "0 0 0 1px oklch(0.66 0.16 60 / 0.4), 0 8px 24px -12px oklch(0.78 0.16 60 / 0.5)",
              }}
            >
              <Check size={12} aria-hidden="true" />
              {loading
                ? isEdit
                  ? "저장 중..."
                  : "등록 중..."
                : isEdit
                  ? "저장"
                  : "등록"}
            </button>
          </div>
        </footer>
      </form>

      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 left-1/2 z-[80] max-w-[min(calc(100vw-2rem),22rem)] -translate-x-1/2 rounded-xl border px-4 py-3 text-center text-sm font-medium shadow-lg ${
            toast.kind === "ok"
              ? "border-emerald-500/30 bg-emerald-950/95 text-emerald-100"
              : "border-red-500/35 bg-red-950/95 text-red-100"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* 단계 D-fixup-4 (분기 X-5-α+δ 통합):
          새 회차 mode 도 SettingsDrawer mount (세계관 + 인물 = works UPDATE, episodeId 무관).
          메모 tab = SettingsDrawer 내부에서 episodeId null 시 비활성 (MemoBody UPSERT 정합). */}
      <SettingsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        workId={workId}
        episodeId={episodeId ?? null}
        episodeNumber={episodeNumber}
        initialWorld={initialWorld}
        initialCharacters={initialCharacters}
        onUnsavedChange={setDrawerUnsaved}
      />
    </>
  );
}
