"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TagInput } from "@/components/TagInput";

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
const CONTRACT_STATUSES = ["미계약", "계약"] as const;

export function AddWorkButton({ userId }: { userId: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("로맨스");
  const [status, setStatus] = useState<"연재중" | "완결" | "휴재">("연재중");
  const [tags, setTags] = useState<string[]>([]);
  const [contractStatus, setContractStatus] = useState<"미계약" | "계약">("미계약");
  const [managementOfferOptIn, setManagementOfferOptIn] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

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
        tags,
        contract_status: contractStatus,
        management_offer_opt_in: managementOfferOptIn,
      });

      if (error) throw error;
      setOpen(false);
      setTitle("");
      setGenre("로맨스");
      setStatus("연재중");
      setTags([]);
      setContractStatus("미계약");
      setManagementOfferOptIn(false);
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
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-xl border border-cyan-500/10 bg-zinc-900 p-6 shadow-2xl shadow-black/40">
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
                  계약 여부
                </label>
                <select
                  value={contractStatus}
                  onChange={(e) =>
                    setContractStatus(e.target.value as (typeof CONTRACT_STATUSES)[number])
                  }
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-zinc-100 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                >
                  {CONTRACT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-lg border border-zinc-800 bg-zinc-950/30 px-4 py-3">
                <label
                  className="flex cursor-pointer items-start gap-3 text-sm text-zinc-400"
                  aria-disabled="true"
                >
                  <input
                    type="checkbox"
                    checked={managementOfferOptIn}
                    onChange={(e) => setManagementOfferOptIn(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-zinc-700 bg-zinc-800 text-cyan-600 opacity-80"
                  />
                  <span className="leading-snug">
                    매니지먼트 계약 제의를 받겠습니다 (현재 서비스 개발 중)
                  </span>
                </label>
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
