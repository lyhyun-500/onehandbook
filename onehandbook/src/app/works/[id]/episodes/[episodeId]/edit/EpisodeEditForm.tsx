"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  EPISODE_CONTENT_MAX_CHARS,
  EPISODE_CONTENT_MAX_LABEL,
  applyEpisodeContentChange,
  countEpisodeContentChars,
  isEpisodeContentWithinLimit,
} from "@/lib/episodeContentLimit";
import { md5Hex } from "@/lib/contentHash";

export function EpisodeEditForm({
  workId,
  episodeId,
  initialTitle,
  initialContent,
}: {
  workId: number;
  episodeId: number;
  initialTitle: string;
  initialContent: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!isEpisodeContentWithinLimit(content)) {
      setError(
        `본문은 회차당 ${EPISODE_CONTENT_MAX_LABEL}(${EPISODE_CONTENT_MAX_CHARS.toLocaleString()}자)까지 등록할 수 있습니다.`
      );
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase
        .from("episodes")
        .update({ title, content, content_hash: md5Hex(content) })
        .eq("id", episodeId);

      if (error) throw error;

      router.push(`/works/${workId}`);
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "수정에 실패했습니다. 다시 시도해주세요.";
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
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-300">
            회차 제목
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={200}
            placeholder="회차 제목을 입력하세요"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label className="block text-sm font-medium text-zinc-300">
              본문
            </label>
            <span
              className={
                !isEpisodeContentWithinLimit(content)
                  ? "text-sm text-red-400"
                  : countEpisodeContentChars(content) >=
                      EPISODE_CONTENT_MAX_CHARS * 0.9
                    ? "text-sm text-amber-400/90"
                    : "text-sm text-zinc-500"
              }
            >
              {countEpisodeContentChars(content).toLocaleString()} /{" "}
              {EPISODE_CONTENT_MAX_CHARS.toLocaleString()}자
            </span>
          </div>
          <p className="mb-2 text-xs text-zinc-500">
            회차당 {EPISODE_CONTENT_MAX_LABEL} 제한입니다.
          </p>
          {!isEpisodeContentWithinLimit(content) && (
            <p className="mb-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
              본문이 {EPISODE_CONTENT_MAX_LABEL}를 초과했습니다. 저장하려면{" "}
              {EPISODE_CONTENT_MAX_CHARS.toLocaleString()}자 이하로 줄여 주세요.
            </p>
          )}
          <textarea
            value={content}
            onChange={(e) =>
              setContent((prev) => applyEpisodeContentChange(prev, e.target.value))
            }
            required
            placeholder="본문 내용을 입력하세요"
            rows={16}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-y"
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-zinc-700 px-6 py-2.5 text-zinc-300 transition-colors hover:bg-zinc-800"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={loading || !isEpisodeContentWithinLimit(content)}
            className="rounded-lg bg-amber-600 px-6 py-2.5 font-medium text-white transition-colors hover:bg-amber-500 disabled:opacity-50"
          >
            {loading ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </form>
  );
}
