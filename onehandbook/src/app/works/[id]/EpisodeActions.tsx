"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export function EpisodeActions({
  workId,
  episodeId,
}: {
  workId: string;
  episodeId: number;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const supabase = createClient();

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await supabase.from("episodes").delete().eq("id", episodeId);

      // works.total_episodes 업데이트
      const { count } = await supabase
        .from("episodes")
        .select("id", { count: "exact", head: true })
        .eq("work_id", workId);
      await supabase
        .from("works")
        .update({ total_episodes: count ?? 0 })
        .eq("id", workId);

      router.refresh();
    } finally {
      setDeleting(false);
      setShowConfirm(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/works/${workId}/episodes/${episodeId}`}
        className="rounded border border-zinc-600 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-100"
      >
        내용보기
      </Link>
      <Link
        href={`/works/${workId}/episodes/${episodeId}/edit`}
        className="rounded border border-zinc-600 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-100"
      >
        편집
      </Link>
      {showConfirm ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">삭제할까요?</span>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="rounded border border-red-600 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50"
          >
            {deleting ? "삭제 중..." : "확인"}
          </button>
          <button
            type="button"
            onClick={() => setShowConfirm(false)}
            className="rounded border border-zinc-600 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800"
          >
            취소
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          className="rounded border border-zinc-600 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-red-600 hover:text-red-400"
        >
          삭제
        </button>
      )}
    </div>
  );
}
