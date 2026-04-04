"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const GENRES = [
  "로맨스",
  "판타지",
  "현대",
  "무협",
  "미스터리",
  "SF",
  "일상",
  "기타",
];

const STATUSES = ["연재중", "완결", "휴재"] as const;

export function AddWorkButton({ userId }: { userId: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("로맨스");
  const [status, setStatus] = useState<"연재중" | "완결" | "휴재">("연재중");
  const [totalEpisodes, setTotalEpisodes] = useState(0);

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.from("works").insert({
        title,
        genre,
        author_id: userId,
        status,
        total_episodes: totalEpisodes,
      });

      if (error) throw error;
      setOpen(false);
      setTitle("");
      setGenre("로맨스");
      setStatus("연재중");
      setTotalEpisodes(0);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "등록에 실패했습니다. 다시 시도해주세요."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 shadow-lg shadow-cyan-500/20 transition-colors hover:bg-cyan-400"
      >
        작품 등록
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-xl border border-cyan-500/10 bg-zinc-900 p-6 shadow-2xl shadow-black/40">
            <h2 className="mb-6 text-lg font-semibold text-zinc-100">
              새 작품 등록
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
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
                  placeholder="작품 제목을 입력하세요"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-zinc-100 placeholder-zinc-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                  장르
                </label>
                <select
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-zinc-100 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
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
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-zinc-100 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
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
                  총 회차
                </label>
                <input
                  type="number"
                  value={totalEpisodes || ""}
                  onChange={(e) =>
                    setTotalEpisodes(Math.max(0, parseInt(e.target.value) || 0))
                  }
                  min={0}
                  placeholder="0"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-zinc-100 placeholder-zinc-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                />
              </div>

              {error && (
                <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
                  {error}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-lg border border-zinc-600 bg-zinc-950/50 px-4 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-800/80"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 shadow-md shadow-cyan-500/15 transition-colors hover:bg-cyan-400 disabled:opacity-50"
                >
                  {loading ? "등록 중..." : "등록"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
