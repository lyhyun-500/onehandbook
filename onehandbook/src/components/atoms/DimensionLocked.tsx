/**
 * 시안 `design_novel/novel-agent/work-analysis.jsx:147-159` 정합 — 분석 0건 시점 DimensionCard placeholder.
 *
 * 6축 grid 중 분석 데이터 부재 영역 = 본 컴포넌트로 채움.
 */
interface DimensionLockedProps {
  label: string;
}

export function DimensionLocked({ label }: DimensionLockedProps) {
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-stone-800/60 bg-stone-900/30 p-5">
      <header className="flex items-start justify-between">
        <h3 className="font-serif text-[14px] text-stone-500">{label}</h3>
        <span
          aria-hidden="true"
          className="font-mono text-[9px] uppercase tracking-widest text-stone-600"
        >
          ·   ·   ·
        </span>
      </header>
      <div className="flex items-end justify-between">
        <span
          aria-hidden="true"
          className="font-serif text-[36px] leading-none tabular-nums text-stone-700"
        >
          —
        </span>
        <span className="font-mono text-[10px] text-stone-600">분석 대기</span>
      </div>
      <p className="font-serif text-[12.5px] leading-relaxed text-stone-600">
        분석 진입 후 6축 평균이 산정됩니다.
      </p>
    </article>
  );
}
