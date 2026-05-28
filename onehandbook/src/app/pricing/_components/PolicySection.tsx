/**
 * 시안 `design_novel/novel-agent/pricing.jsx:210-242` 정합 — NAT 차감 정책 zebra table.
 *
 * NAT_POLICY 본질 = 시안 정합 우선 (LEE 결정 X2 (a)). CLAUDE.md 기존 정책 (3,000/6,000자) 영역과
 * 충돌 — CLAUDE.md 갱신은 별 sub-phase #88 박힘.
 */
const NAT_POLICY: { range: string; cost: string; hint: string }[] = [
  { range: "6,000자 이하", cost: "1", hint: "단편·콩트" },
  { range: "6,001 – 10,000자", cost: "2", hint: "일반 연재 회차" },
  { range: "플랫폼 최적화 옵션", cost: "+1", hint: "회차당 추가, 선택 옵션" },
];

export function PolicySection() {
  return (
    <section className="rounded-lg border border-stone-800/60 bg-stone-900/40 p-6">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-sky-300/70">
            POLICY
          </div>
          <h3 className="mt-0.5 font-serif text-[15px] text-stone-100">
            NAT 차감 정책
          </h3>
        </div>
        <span className="font-mono text-[10px] text-stone-600">
          v1.5 · 2026-05 기준
        </span>
      </header>

      <div className="overflow-hidden rounded-md border border-stone-800/60">
        {NAT_POLICY.map((row, i) => (
          <div
            key={row.range}
            className={`grid grid-cols-[1fr_auto_1.4fr] items-center gap-4 px-4 py-3 text-[12.5px] ${
              i % 2 === 0 ? "bg-stone-950/30" : "bg-stone-900/30"
            } ${i < NAT_POLICY.length - 1 ? "border-b border-stone-800/40" : ""}`}
          >
            <div className="text-stone-200">{row.range}</div>
            <div className="font-mono text-[13px] tabular-nums text-sky-300">
              {row.cost}{" "}
              <span className="text-[10px] uppercase tracking-widest text-sky-300/60">
                NAT
              </span>
            </div>
            <div className="text-[11px] text-stone-500">{row.hint}</div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-[11.5px] leading-relaxed text-stone-400">
        분석 결과가 도출되지 않은 경우 (처리 오류·시간 초과) NAT는 자동
        환원됩니다. 회차 임시 분석·미리보기는 NAT를 차감하지 않습니다.
      </p>
    </section>
  );
}
