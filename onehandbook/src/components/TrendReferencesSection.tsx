import type { TrendReferenceItem } from "@/lib/ai/types";

export function TrendReferencesSection({
  references,
}: {
  references?: TrendReferenceItem[] | null;
}) {
  if (!references?.length) return null;

  return (
    <section className="mt-6 border-t border-zinc-800 pt-5">
      <h3 className="text-sm font-semibold text-zinc-200">
        참고한 최신 트렌드 지표
      </h3>
      <p className="mt-1 text-xs text-zinc-500">
        이번 분석에 RAG로 주입된 시장·트렌드 자료의 출처입니다. 날짜는 코퍼스에
        표기된 기준일입니다.
      </p>
      <ul className="mt-3 space-y-2 text-sm text-zinc-400">
        {references.map((r, i) => (
          <li
            key={`${r.source}\0${r.date}\0${i}`}
            className="flex flex-col gap-0.5 rounded-lg border border-zinc-800/80 bg-zinc-950/60 px-3 py-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
          >
            <span className="font-medium text-zinc-300 break-all">{r.source}</span>
            <span className="shrink-0 tabular-nums text-xs text-zinc-500 sm:text-sm">
              기준일 {r.date}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
