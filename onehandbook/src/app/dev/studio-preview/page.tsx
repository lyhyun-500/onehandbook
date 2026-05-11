"use client";

/**
 * studio-preview — 페이즈 2-D /studio 컴포넌트 시각 검증 페이지.
 * /dev/* 는 proxy.ts 의 production 차단 정책 적용 (ADR-0018).
 *
 * 박힌 컴포넌트 (점진 추가):
 * - Sparkline (Phase 2-D-2)
 * - StudioWorkCard (Phase 2-D-3, 예정)
 * - StudioStatsStrip / StudioFilters (Phase 2-D-4, 예정)
 *
 * 시안의 다크 작업실 톤 박음 — bg-stone-950 + 시안 정합.
 */

import { Sparkline } from "@/components/studio/Sparkline";
import {
  StudioWorkCard,
  type StudioWorkData,
} from "@/components/studio/StudioWorkCard";

const MOCK_WORKS: StudioWorkData[] = [
  {
    id: 1,
    title: "황실의 그림자, 검은 장미",
    genre: "로맨스",
    status: "연재중",
    totalEpisodes: 47,
    agentScore: 84,
    lastAnalyzedAt: "2026-05-04",
    recentScores: [78, 82, 89, 84, 87],
  },
  {
    id: 2,
    title: "검신: 다시 태어난 무제",
    genre: "무협",
    status: "연재중",
    totalEpisodes: 122,
    agentScore: 91,
    lastAnalyzedAt: "2026-05-06",
    recentScores: [88, 90, 89, 92, 91],
  },
  {
    id: 3,
    title: "회귀자의 편의점",
    genre: "현대물",
    status: "연재중",
    totalEpisodes: 33,
    agentScore: 76,
    lastAnalyzedAt: "2026-05-02",
    recentScores: [72, 75, 74, 78, 76],
  },
  {
    id: 4,
    title: "마지막 마법사의 일기",
    genre: "판타지",
    status: "휴재",
    totalEpisodes: 18,
    agentScore: 68,
    lastAnalyzedAt: "2026-04-21",
    recentScores: [62, 68, 70, 65, 68],
  },
  {
    id: 5,
    title: "구단주의 백서",
    genre: "스포츠",
    status: "연재중",
    totalEpisodes: 9,
    agentScore: null,
    lastAnalyzedAt: null,
    recentScores: null,
  },
  {
    id: 6,
    title: "북풍의 검",
    genre: "무협",
    status: "완결",
    totalEpisodes: 240,
    agentScore: 88,
    lastAnalyzedAt: "2026-03-18",
    recentScores: [85, 88, 89, 87, 90],
  },
];

const MOCK_SCORE_PATTERNS: { label: string; scores: number[] }[] = [
  { label: "high (emerald 90+)", scores: [88, 90, 92, 91, 95, 93, 90] },
  { label: "mid (amber 80~89)", scores: [78, 82, 85, 80, 84, 86, 82] },
  { label: "low-mid (amber 70~79)", scores: [68, 72, 75, 73, 78, 74, 76] },
  { label: "low (orange 60~69)", scores: [55, 60, 64, 62, 67, 63, 65] },
  { label: "very low (rose <60)", scores: [42, 48, 52, 50, 55, 53, 50] },
  { label: "rising trend", scores: [55, 60, 68, 75, 82, 88, 92] },
  { label: "falling trend", scores: [92, 88, 80, 75, 65, 58, 50] },
  { label: "mixed (5단계 mix)", scores: [62, 75, 88, 92, 80, 70, 65, 58] },
];

export default function StudioPreviewPage() {
  return (
    <div className="relative min-h-screen w-full bg-stone-950 text-stone-200">
      <div className="mx-auto max-w-3xl px-12 py-16">
        <header className="mb-10 space-y-2">
          <h1 className="font-serif text-2xl text-stone-100">
            studio preview (Phase 2-D)
          </h1>
          <p className="text-sm text-stone-400">
            Sparkline + StudioWorkCard + StudioStatsStrip + StudioFilters 시각
            검증. ADR-0024 결정 13 박음.
          </p>
        </header>

        <section className="space-y-6">
          <h2 className="text-[11px] tracking-widest text-sky-300/85">
            Sparkline (Phase 2-D-2)
          </h2>
          {MOCK_SCORE_PATTERNS.map(({ label, scores }) => (
            <div key={label} className="space-y-2">
              <div className="text-xs text-stone-400">
                {label} — [{scores.join(", ")}]
              </div>
              <div className="rounded-lg border border-stone-800 bg-stone-900/40 p-4">
                <Sparkline scores={scores} />
              </div>
            </div>
          ))}

          <div className="space-y-2">
            <div className="text-xs text-stone-400">
              empty (scores=[]) — return null (시안 정합)
            </div>
            <div className="rounded-lg border border-stone-800 bg-stone-900/40 p-4">
              <Sparkline scores={[]} />
              <span className="text-[10px] text-stone-500">
                (Sparkline 박지 않음)
              </span>
            </div>
          </div>
        </section>

        <section className="mt-12 space-y-6">
          <h2 className="text-[11px] tracking-widest text-sky-300/85">
            StudioWorkCard — card variant (Phase 2-D-3)
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {MOCK_WORKS.map((w) => (
              <StudioWorkCard key={w.id} work={w} layout="card" />
            ))}
          </div>

          <h2 className="mt-8 text-[11px] tracking-widest text-sky-300/85">
            StudioWorkCard — list variant
          </h2>
          <div className="space-y-3">
            {MOCK_WORKS.map((w) => (
              <StudioWorkCard key={w.id} work={w} layout="list" />
            ))}
          </div>

          <h2 className="mt-8 text-[11px] tracking-widest text-sky-300/85">
            density 분기 (compact / dense / default)
          </h2>
          <div className="space-y-3">
            <StudioWorkCard work={MOCK_WORKS[0]} layout="list" density="compact" />
            <StudioWorkCard work={MOCK_WORKS[0]} layout="list" density="dense" />
            <StudioWorkCard work={MOCK_WORKS[0]} layout="list" density="default" />
          </div>

          <h2 className="mt-8 text-[11px] tracking-widest text-sky-300/85">
            workAnalyzing pulse 박음 (시안 외 — 기존 기능 보존)
          </h2>
          <div className="space-y-3">
            <StudioWorkCard work={MOCK_WORKS[0]} layout="list" workAnalyzing />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <StudioWorkCard work={MOCK_WORKS[0]} layout="card" workAnalyzing />
              <StudioWorkCard work={MOCK_WORKS[1]} layout="card" workAnalyzing />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
