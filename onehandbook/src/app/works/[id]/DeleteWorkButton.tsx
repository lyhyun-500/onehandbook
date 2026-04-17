"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteWorkButton({ workId }: { workId: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const onDelete = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/works/${workId}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "삭제에 실패했습니다.");
      setOpen(false);
      router.push("/studio");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "삭제에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-red-500/40 bg-red-950/20 px-4 py-2 text-sm font-medium text-red-200 transition-colors hover:border-red-500/60 hover:bg-red-950/35"
      >
        작품 삭제
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]">
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-xl border border-red-500/15 bg-zinc-900 p-6 shadow-2xl shadow-black/40">
            <h2 className="mb-3 text-lg font-semibold text-zinc-100">
              작품을 삭제할까요?
            </h2>
            <p className="mb-5 rounded-lg border border-red-500/20 bg-red-950/20 px-4 py-3 text-sm text-red-100/95">
              분석에 사용된 NAT은 환불되지 않으며, 모든 데이터가 삭제됩니다.
            </p>

            {error && (
              <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={loading}
                className="flex-1 rounded-lg border border-zinc-600 bg-zinc-950/50 px-4 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-800/80 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={loading}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-red-600/15 transition-colors hover:bg-red-500 disabled:opacity-50"
              >
                {loading ? "삭제 중..." : "삭제하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

