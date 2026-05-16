"use client";

function DimensionSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-3 rounded-lg border border-stone-800/60 bg-stone-900/40 p-5">
      <div className="flex justify-between">
        <div className="h-3 w-20 rounded bg-stone-800/80" />
        <div className="h-2 w-8 rounded bg-stone-800/60" />
      </div>
      <div className="h-10 w-20 rounded bg-stone-800/70" />
      <div className="space-y-1.5">
        <div className="h-2 w-full rounded bg-stone-800/50" />
        <div className="h-2 w-[88%] rounded bg-stone-800/50" />
        <div className="h-2 w-[64%] rounded bg-stone-800/50" />
      </div>
    </div>
  );
}

export function AnalysisProcessing() {
  return (
    <section className="mt-6">
      <div className="mb-4 flex items-center gap-3 rounded-lg border border-sky-400/25 bg-sky-400/[0.04] px-4 py-3">
        <span className="relative flex h-2 w-2">
          <span className="absolute inset-0 animate-ping rounded-full bg-sky-400/50" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-300" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-serif text-[13px] text-stone-100">분석 진행 중…</div>
          <div className="mt-0.5 text-[11px] text-stone-500">
            평균 40초 소요 · 완료 시 자동으로 결과가 표시됩니다.
          </div>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-widest text-sky-300/80">
          Realtime
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <DimensionSkeleton key={i} />
        ))}
      </div>
    </section>
  );
}
