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

export function EpisodeEditor({
  workId,
  episodeNumber,
}: {
  workId: number;
  episodeNumber: number;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
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
      const { error } = await supabase.from("episodes").insert({
        work_id: workId,
        episode_number: episodeNumber,
        title: title,
        content: content,
        content_hash: md5Hex(content),
      });

      if (error) throw error;

      // works.total_episodes 업데이트
      const { count } = await supabase
        .from("episodes")
        .select("id", { count: "exact", head: true })
        .eq("work_id", workId);
      await supabase
        .from("works")
        .update({ total_episodes: count ?? episodeNumber })
        .eq("id", workId);

      router.push(`/works/${workId}`);
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "업로드에 실패했습니다. 다시 시도해주세요.";
      setError(message);
      console.error("Episode upload error:", err);
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
                countEpisodeContentChars(content) >=
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
            회차당 {EPISODE_CONTENT_MAX_LABEL} 제한입니다. 긴 원고는 회차를
            나누어 등록해 주세요.
          </p>
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
            disabled={loading}
            className="rounded-lg bg-amber-600 px-6 py-2.5 font-medium text-white transition-colors hover:bg-amber-500 disabled:opacity-50"
          >
            {loading ? "업로드 중..." : "회차 업로드"}
          </button>
        </div>
      </div>
    </form>
  );
}
