"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X } from "lucide-react";
import {
  buildHolisticNatBreakdown,
  estimateHolisticBatchTotalNat,
  type NatAnalysisOptions,
} from "@/lib/nat";
import { HOLISTIC_CLIENT_CHUNK_SIZE } from "@/lib/analysis/holisticEpisodeChunks";
import { ANALYSIS_PROFILES } from "@/config/analysis-profiles";
import {
  getLoreNullCase,
  getLoreNullPromptText,
} from "@/lib/works/loreCheck";
import type {
  CharacterSettings,
  WorldSetting,
} from "@/components/side-panel/types";

// 정책 변경: 단일 택1 모델 — generic(범용) UI 노출 + 맨 앞 정렬.
// payload 호환: platform === "generic" → includePlatformOptimization=false derive.
const PLATFORM_OPTIONS = [
  ...ANALYSIS_PROFILES.filter((p) => p.id === "generic"),
  ...ANALYSIS_PROFILES.filter((p) => p.id !== "generic"),
];

const HOLISTIC_MAX_EPISODES = 50;

export interface BatchAnalyzeEpisode {
  id: number;
  episode_number: number;
  title: string;
  charCount: number;
  analyzed: boolean;
}

type Filter = "all" | "unanalyzed" | "analyzed";
type DragMode = "add" | "remove";

interface DragState {
  active: boolean;
  anchorId: number | null;
  currentId: number | null;
  mode: DragMode;
  /** mousedown 직후 click 직전, 드래그 임계치 통과 시 single-click 차단 플래그. */
  moved: boolean;
}

interface BatchAnalyzeModalProps {
  open: boolean;
  onClose: () => void;
  workId: number;
  episodes: BatchAnalyzeEpisode[];
  natBalance: number;
  /** default agentVersion (셀렉트박스 초기값). J-H 정정으로 모달 안에서 사용자 선택 가능. */
  agentVersion: string;
  /** 의제 신규-1+2 (단계 C-2): NULL 분기 검증용 (결정 23 옵션 X 정합). */
  worldSetting: WorldSetting;
  characterSettings: CharacterSettings;
}

/**
 * 일괄 통합 분석 단일 진입점 (작품 상세 「일괄 통합 분석」 버튼).
 *
 * 5상태:
 *   A 선택전 → B 선택됨(NAT 충분) → C 과금확인(2-step) → D NAT부족 / E 실행직후
 * 정책 (LEE 확정):
 *   - 2-step always (금액 무관)
 *   - 드래그 범위 선택 PC 전용
 *   - NAT = estimateHolisticBatchTotalNat (회차당 1 NAT + 옵션 +1, 청크 분할 시 merge +2)
 *   - 409 EPISODE_ANALYSIS_IN_PROGRESS: rose alert + 해당 회차 auto-deselect + NAT 재계산
 *   - processing 중 닫기 불가 (백그라운드로 두기만)
 */
export function BatchAnalyzeModal({
  open,
  onClose,
  workId,
  episodes,
  natBalance,
  agentVersion,
  worldSetting,
  characterSettings,
}: BatchAnalyzeModalProps) {
  const router = useRouter();

  // 의제 신규-1+2 (단계 C-2): NULL 분기 영속화 (결정 9 옵션 N-2 + 결정 23 옵션 X).
  // 본 단계 = inline 안내만, 추출 LLM 사양 = commit 3 (단계 C-4) 진입 영속화.
  const loreNullCase = useMemo(
    () => getLoreNullCase(worldSetting, characterSettings),
    [worldSetting, characterSettings],
  );
  const loreNullPrompt = useMemo(
    () => getLoreNullPromptText(loreNullCase),
    [loreNullCase],
  );

  const [filter, setFilter] = useState<Filter>("all");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  // 정책 변경: 단일 택1 모델 (범용 포함). default = "generic".
  // includePlatformOptimization은 platform에서 derive (독립 상태 폐기).
  const [platform, setPlatform] = useState<string>("generic");
  const includePlatformOptimization = platform !== "generic";
  const [confirming, setConfirming] = useState(false);
  const [phase, setPhase] = useState<"idle" | "submitting" | "launched">(
    "idle",
  );
  // 단계 D-fixup-1 (결정 33 UX-1 + 34 D-1): 추출 단계 = 통합 "분석 중" UX.
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflictIds, setConflictIds] = useState<Set<number>>(new Set());

  const drag = useRef<DragState>({
    active: false,
    anchorId: null,
    currentId: null,
    mode: "add",
    moved: false,
  });
  const [, force] = useState(0);
  const rerenderDrag = useCallback(() => force((n) => n + 1), []);

  // open 변화 시 상태 초기화 (단 launched 중에는 보존)
  useEffect(() => {
    if (!open) {
      // 닫힐 때 초기화는 phase==launched 아닐 때만
      if (phase !== "submitting") {
        setConfirming(false);
        setError(null);
        setConflictIds(new Set());
      }
      return;
    }
    setConfirming(false);
    setError(null);
    setConflictIds(new Set());
    setPhase("idle");
    // selectedIds 는 유지 (모달 재오픈 시 직전 선택 보존)
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // ESC 닫기 (processing 중 차단)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (phase === "submitting") return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, phase]);

  // J-D 정정 (LEE 라운드2): 모달 열림 시 body 스크롤 차단.
  // 모달 안 어느 영역에서 스크롤하든 외부 페이지가 안 움직이게.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // 필터 적용
  const visibleEpisodes = useMemo(() => {
    if (filter === "unanalyzed") return episodes.filter((e) => !e.analyzed);
    if (filter === "analyzed") return episodes.filter((e) => e.analyzed);
    return episodes;
  }, [episodes, filter]);

  const counts = useMemo(
    () => ({
      all: episodes.length,
      unanalyzed: episodes.filter((e) => !e.analyzed).length,
      analyzed: episodes.filter((e) => e.analyzed).length,
    }),
    [episodes],
  );

  // 선택 통계
  const selectedList = useMemo(
    () => episodes.filter((e) => selectedIds.has(e.id)),
    [episodes, selectedIds],
  );
  const selectedEpisodeIds = useMemo(
    () => selectedList.map((e) => e.id),
    [selectedList],
  );
  const totalChars = selectedList.reduce((s, e) => s + e.charCount, 0);

  const chunkCount = Math.ceil(selectedList.length / HOLISTIC_CLIENT_CHUNK_SIZE) || 0;
  const overLimit = selectedList.length > HOLISTIC_MAX_EPISODES;
  // Inngest 전환 전 임시 차단 (client-driven chunking driver 부재로 11화 이상 좀비 잡 방지).
  const chunkingDisabled = selectedList.length > HOLISTIC_CLIENT_CHUNK_SIZE;

  // NAT 비용 (운영 정합 — 의제 신규-1+2: includeLore 폐기)
  const natOpts: NatAnalysisOptions = {
    includePlatformOptimization,
  };
  const natEst = useMemo(
    () =>
      estimateHolisticBatchTotalNat(
        selectedList.map((e) => ({ id: e.id, charCount: e.charCount })),
        selectedEpisodeIds,
        natOpts,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedEpisodeIds, platform],
  );
  const natBreakdown = useMemo(
    () => buildHolisticNatBreakdown(selectedList.length, natOpts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedList.length, platform],
  );

  const insufficient = natEst.total > natBalance;
  const balanceAfter = Math.max(0, natBalance - natEst.total);

  // ETA — 운영 estimateHolisticJobSeconds 정합 (35 + count*18 + chunkCount>1 시 45+chunk*25)
  const etaSeconds =
    selectedList.length === 0
      ? 0
      : 35 +
        selectedList.length * 18 +
        (chunkCount > 1 ? 45 + chunkCount * 25 : 0);

  const toggleId = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setConfirming(false);
  }, []);

  // confirm 중 선택 변경 시 자동 해제
  const applyRangeSelection = useCallback(
    (mode: DragMode, anchorId: number, currentId: number) => {
      const idxA = visibleEpisodes.findIndex((e) => e.id === anchorId);
      const idxB = visibleEpisodes.findIndex((e) => e.id === currentId);
      if (idxA < 0 || idxB < 0) return;
      const [lo, hi] = idxA <= idxB ? [idxA, idxB] : [idxB, idxA];
      const ids = visibleEpisodes.slice(lo, hi + 1).map((e) => e.id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of ids) {
          if (mode === "add") next.add(id);
          else next.delete(id);
        }
        return next;
      });
      setConfirming(false);
    },
    [visibleEpisodes],
  );

  // window mouseup — 드래그 commit
  useEffect(() => {
    if (!open) return;
    const onUp = () => {
      const d = drag.current;
      if (!d.active) return;
      if (d.moved && d.anchorId != null && d.currentId != null) {
        applyRangeSelection(d.mode, d.anchorId, d.currentId);
      }
      drag.current = {
        active: false,
        anchorId: null,
        currentId: null,
        mode: "add",
        moved: false,
      };
      rerenderDrag();
    };
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, [open, applyRangeSelection, rerenderDrag]);

  const startDrag = (epId: number) => {
    const isSelected = selectedIds.has(epId);
    drag.current = {
      active: true,
      anchorId: epId,
      currentId: epId,
      mode: isSelected ? "remove" : "add",
      moved: false,
    };
    rerenderDrag();
  };

  const onRowEnter = (epId: number) => {
    if (!drag.current.active) return;
    if (drag.current.currentId !== epId) {
      drag.current.currentId = epId;
      drag.current.moved = true;
      rerenderDrag();
    }
  };

  const isInDragRange = (epId: number) => {
    const d = drag.current;
    if (!d.active || !d.moved || d.anchorId == null || d.currentId == null) {
      return false;
    }
    const idxA = visibleEpisodes.findIndex((e) => e.id === d.anchorId);
    const idxB = visibleEpisodes.findIndex((e) => e.id === d.currentId);
    const idxRow = visibleEpisodes.findIndex((e) => e.id === epId);
    if (idxA < 0 || idxB < 0 || idxRow < 0) return false;
    const [lo, hi] = idxA <= idxB ? [idxA, idxB] : [idxB, idxA];
    return idxRow >= lo && idxRow <= hi;
  };

  const quickSelect = (range: "1-10" | "11-20" | "unanalyzed-only") => {
    setSelectedIds(() => {
      const next = new Set<number>();
      if (range === "1-10") {
        for (const e of episodes) {
          if (e.episode_number >= 1 && e.episode_number <= 10) next.add(e.id);
        }
      } else if (range === "11-20") {
        for (const e of episodes) {
          if (e.episode_number >= 11 && e.episode_number <= 20) next.add(e.id);
        }
      } else {
        for (const e of episodes) {
          if (!e.analyzed) next.add(e.id);
        }
      }
      return next;
    });
    setConfirming(false);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setConfirming(false);
  };

  const handleExecute = async () => {
    if (selectedList.length === 0) return;
    if (insufficient) return;
    if (overLimit) return;
    if (chunkingDisabled) {
      setError(
        "현재 11회차 이상 일괄분석은 시스템 개선 작업으로 일시 중단되었습니다.",
      );
      return;
    }
    setPhase("submitting");
    setError(null);
    setConflictIds(new Set());
    try {
      // 의제 신규-1+2 단계 C-4: NULL 분기 시 추출 API 선행 (결정 11 옵션 EX-3 +
      // 결정 12 옵션 IN-1). 분석 대상 = 선택 첫 회차 본문 (옵션 B-1 정합).
      // 단계 D-fixup-1 (결정 33 UX-1): 추출 단계 = 통합 "분석 중" UX (extracting state).
      if (loreNullCase !== "both_present") {
        const firstEpId = selectedEpisodeIds[0];
        if (firstEpId != null) {
          setExtracting(true);
          const exRes = await fetch(`/api/works/${workId}/extract-lore`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ episodeId: firstEpId }),
          });
          if (!exRes.ok) {
            const exData = (await exRes.json().catch(() => ({}))) as {
              error?: string;
              code?: string;
            };
            if (exData.code !== "LORE_ALREADY_PRESENT") {
              const msg =
                typeof exData.error === "string" && exData.error.length > 0
                  ? exData.error
                  : "추출 실패";
              setError(`추출 실패: ${msg}`);
              setPhase("idle");
              setExtracting(false);
              return;
            }
            // 세계관·인물 양쪽 이미 존재 = 추출 불필요 → 일괄 분석 그대로 진행
          }
          setExtracting(false);
        }
      }

      const res = await fetch("/api/analyze-batch-holistic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          episodeIds: selectedEpisodeIds,
          workId,
          // 정책 변경: 단일 택1. platform === "generic" → includePlatformOptimization=false derive (payload 호환 유지).
          agentVersion: platform,
          // includeLore = 항상 true (의제 신규-1+2 정합), payload 호환용 영속화.
          includeLore: true,
          includePlatformOptimization,
        }),
      });
      if (res.ok) {
        setPhase("launched");
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        conflicting_episode_ids?: number[];
      };
      if (res.status === 409 && data.code === "EPISODE_ANALYSIS_IN_PROGRESS") {
        // 409 처리 (LEE 확정): 해당 회차 auto-deselect + alert
        const conflicts = new Set(data.conflicting_episode_ids ?? []);
        setConflictIds(conflicts);
        setSelectedIds((prev) => {
          const next = new Set(prev);
          for (const id of conflicts) next.delete(id);
          return next;
        });
        setError(
          "일부 회차가 이미 진행 중인 분석에 포함되어 있습니다. 자동으로 제외했으니 다시 실행해 주세요.",
        );
        setConfirming(false);
        setPhase("idle");
        return;
      }
      if (res.status === 402 && data.code === "INSUFFICIENT_NAT") {
        // NAT 부족은 이미 D상태로 사전 표시됨 — 서버 응답 일치 확인용 fallback
        setError(data.error ?? "NAT가 부족합니다.");
        setPhase("idle");
        return;
      }
      if (res.status === 503 && data.code === "BATCH_TEMPORARILY_DISABLED") {
        // UI 가드 우회 (cache stale / 직접 API 호출) 대비 fallback.
        setError(
          data.error ??
            "현재 11회차 이상 일괄분석은 시스템 개선 작업으로 일시 중단되었습니다.",
        );
        setPhase("idle");
        setConfirming(false);
        return;
      }
      setError(data.error ?? "분석 작업을 시작할 수 없습니다.");
      setPhase("idle");
    } catch (e: unknown) {
      const message =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: string }).message)
          : "분석 작업을 시작할 수 없습니다.";
      setError(message);
      setPhase("idle");
    }
  };

  // 상태 판정 (5상태)
  const state: "A" | "B" | "C" | "D" | "E" =
    phase === "launched"
      ? "E"
      : selectedList.length === 0
        ? "A"
        : insufficient
          ? "D"
          : confirming
            ? "C"
            : "B";

  const canCloseNow = phase !== "submitting";

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="일괄 통합 분석"
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      <div
        onClick={() => {
          if (canCloseNow) onClose();
        }}
        className="absolute inset-0 bg-stone-950/55 backdrop-blur-[1px]"
        aria-hidden="true"
      />
      <div className="relative flex max-h-[88vh] w-[720px] flex-col overflow-hidden rounded-xl border border-stone-800 bg-stone-950/95 shadow-[0_24px_64px_-16px_rgba(0,0,0,0.7)] backdrop-blur">
        <header className="flex items-start justify-between gap-4 border-b border-stone-800/60 px-6 py-5">
          <div>
            <div className="font-mono text-[10.5px] uppercase tracking-[0.3em] text-sky-300/75">
              일괄 통합 분석
            </div>
            <h2 className="mt-1.5 font-serif text-[20px] font-medium text-stone-100">
              분석할 회차를 묶어 한 번에 실행
            </h2>
            <p className="mt-1 text-[12px] text-stone-500">
              선택한 회차들을 한 번의 분석 호출로 통합 분석합니다. 회차당 1
              NAT.
            </p>
          </div>
          <button
            type="button"
            onClick={() => canCloseNow && onClose()}
            disabled={!canCloseNow}
            className="flex h-8 w-8 items-center justify-center rounded-md text-stone-400 hover:bg-stone-100/[0.04] hover:text-stone-100 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="모달 닫기"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </header>

        {state === "E" ? (
          <LaunchedBody
            count={selectedList.length}
            workId={workId}
            onBackground={onClose}
            onGoBoardgame={() => {
              router.push(`/works/${workId}/analysis?tab=holistic`);
              onClose();
            }}
          />
        ) : (
          <>
            <div className="flex min-h-0 flex-1 gap-0">
              <EpisodeListPanel
                episodes={episodes}
                visibleEpisodes={visibleEpisodes}
                filter={filter}
                setFilter={setFilter}
                counts={counts}
                selectedIds={selectedIds}
                conflictIds={conflictIds}
                onToggle={toggleId}
                onStartDrag={startDrag}
                onRowEnter={onRowEnter}
                isInDragRange={isInDragRange}
                onClearSelection={clearSelection}
                onQuickSelect={quickSelect}
              />
              <SummaryPanel
                state={state}
                selectedCount={selectedList.length}
                totalEpisodes={episodes.length}
                totalChars={totalChars}
                etaSeconds={etaSeconds}
                natBalance={natBalance}
                natTotal={natEst.total}
                balanceAfter={balanceAfter}
                natLines={natBreakdown.lines}
                platform={platform}
                setPlatform={(v) => {
                  setPlatform(v);
                  setConfirming(false);
                }}
                overLimit={overLimit}
                chunkingDisabled={chunkingDisabled}
                chunkCount={chunkCount}
                error={error}
                loreNullPrompt={loreNullPrompt}
                extracting={extracting}
                analyzing={phase === "submitting"}
              />
            </div>

            <footer className="flex items-center justify-between gap-3 border-t border-stone-800/60 bg-stone-950/90 px-6 py-4">
              <div className="font-mono text-[11px] tabular-nums text-stone-500">
                선택 {selectedList.length} / 총 {episodes.length}화
                {overLimit && (
                  <span className="ml-2 text-rose-300/90">
                    (최대 {HOLISTIC_MAX_EPISODES}화 초과)
                  </span>
                )}
                {!overLimit && chunkingDisabled && (
                  <span className="ml-2 text-rose-300/90">
                    (11회차 이상 일시 중단)
                  </span>
                )}
              </div>
              <FooterActions
                state={state}
                onCancel={() => canCloseNow && onClose()}
                onConfirm={() => setConfirming(true)}
                onExecute={handleExecute}
                onBackToSelect={() => setConfirming(false)}
                onTopUp={() => router.push("/billing")}
                submitting={phase === "submitting"}
                natTotal={natEst.total}
                disabledExecute={overLimit || chunkingDisabled}
              />
            </footer>
          </>
        )}
      </div>
    </div>
  );
}

function EpisodeListPanel({
  episodes,
  visibleEpisodes,
  filter,
  setFilter,
  counts,
  selectedIds,
  conflictIds,
  onToggle,
  onStartDrag,
  onRowEnter,
  isInDragRange,
  onClearSelection,
  onQuickSelect,
}: {
  episodes: BatchAnalyzeEpisode[];
  visibleEpisodes: BatchAnalyzeEpisode[];
  filter: Filter;
  setFilter: (f: Filter) => void;
  counts: { all: number; unanalyzed: number; analyzed: number };
  selectedIds: Set<number>;
  conflictIds: Set<number>;
  onToggle: (id: number) => void;
  onStartDrag: (id: number) => void;
  onRowEnter: (id: number) => void;
  isInDragRange: (id: number) => boolean;
  onClearSelection: () => void;
  onQuickSelect: (range: "1-10" | "11-20" | "unanalyzed-only") => void;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-stone-800/60 px-5 py-3">
        <FilterChip
          active={filter === "all"}
          onClick={() => setFilter("all")}
          label="전체"
          count={counts.all}
        />
        <FilterChip
          active={filter === "unanalyzed"}
          onClick={() => setFilter("unanalyzed")}
          label="미분석"
          count={counts.unanalyzed}
        />
        <FilterChip
          active={filter === "analyzed"}
          onClick={() => setFilter("analyzed")}
          label="분석됨"
          count={counts.analyzed}
          dim
        />
        <span className="ml-2 text-stone-700">·</span>
        <QuickChip onClick={() => onQuickSelect("1-10")}>1~10화</QuickChip>
        <QuickChip onClick={() => onQuickSelect("11-20")}>11~20화</QuickChip>
        <QuickChip onClick={() => onQuickSelect("unanalyzed-only")}>
          미분석만
        </QuickChip>
        {selectedIds.size > 0 && (
          <button
            type="button"
            onClick={onClearSelection}
            className="ml-auto font-mono text-[10px] uppercase tracking-widest text-stone-400 hover:text-rose-300"
          >
            선택 해제
          </button>
        )}
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto">
        {visibleEpisodes.length === 0 ? (
          <li className="px-5 py-8 text-center font-serif text-[13px] text-stone-500">
            조건에 맞는 회차가 없습니다.
          </li>
        ) : (
          visibleEpisodes.map((ep) => {
            const checked = selectedIds.has(ep.id);
            const inRange = isInDragRange(ep.id);
            const conflict = conflictIds.has(ep.id);
            return (
              <li
                key={ep.id}
                onMouseDown={(e) => {
                  // 체크박스 input 클릭은 native toggle 으로 위임 (드래그 시작 안 함)
                  const target = e.target as HTMLElement;
                  if (target.tagName === "INPUT") return;
                  e.preventDefault();
                  onStartDrag(ep.id);
                }}
                onMouseEnter={() => onRowEnter(ep.id)}
                className={`flex cursor-pointer items-center gap-3 border-b border-stone-800/30 px-5 py-2.5 text-[13px] transition-colors ${
                  conflict
                    ? "bg-rose-500/[0.06] ring-1 ring-rose-400/30"
                    : inRange
                      ? "ring-1 ring-inset ring-sky-400/40 bg-sky-400/[0.04]"
                      : "hover:bg-stone-100/[0.02]"
                }`}
                onClick={(e) => {
                  // mousedown 에서 dragMove 가 일어났다면 click 무시 (window mouseup 이 처리함)
                  const target = e.target as HTMLElement;
                  if (target.tagName === "INPUT") return;
                  // 단일 클릭 (no drag) — 일반 toggle
                  // drag.moved 가 false 였으면 toggle 수행 — 단순화 위해 mousedown→mouseup 사이 moved 가 false 면 click 통과 후 여기서 toggle
                  // 단 mouseup 도 commit 을 하므로 단일클릭은 commit 시 range=1 → 같은 결과. 중복 toggle 방지 위해 click 에서는 아무것도 안 함.
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(ep.id)}
                  className="h-4 w-4 cursor-pointer accent-sky-400"
                  aria-label={`${ep.episode_number}화 선택`}
                />
                <span className="w-14 shrink-0 font-mono text-[11.5px] tabular-nums text-stone-500">
                  EP.{String(ep.episode_number).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1 truncate font-serif text-stone-100">
                  {ep.title}
                </span>
                <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-stone-500">
                  {ep.charCount.toLocaleString("ko-KR")}자
                </span>
                <AnalyzedBadge analyzed={ep.analyzed} />
                <span className="w-12 shrink-0 text-right font-mono text-[10.5px] tabular-nums text-stone-500">
                  1 NAT
                </span>
              </li>
            );
          })
        )}
      </ul>

      <div className="sticky bottom-0 flex items-center gap-2 border-t border-stone-800/60 bg-stone-950/95 px-5 py-2.5 backdrop-blur">
        <span className="inline-flex items-center rounded-sm border border-sky-400/30 bg-sky-400/[0.08] px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-widest text-sky-200">
          TIP
        </span>
        <span className="text-[11px] text-stone-400">
          여러 회차를 골라 분석하고 싶다면, 행을 드래그해서 범위로 선택할 수
          있습니다.
        </span>
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count,
  dim,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  dim?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 font-mono text-[10.5px] transition-colors ${
        active
          ? "border-sky-400/50 bg-sky-400/[0.12] text-sky-100"
          : dim
            ? "border-stone-800/60 bg-stone-900/30 text-stone-600 hover:border-stone-700 hover:text-stone-400"
            : "border-stone-700 bg-stone-900/40 text-stone-300 hover:border-sky-400/40 hover:text-sky-200"
      }`}
    >
      {label}{" "}
      <span className="tabular-nums opacity-70">{count}</span>
    </button>
  );
}

function QuickChip({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-stone-800 bg-stone-900/30 px-2.5 py-1 font-mono text-[10.5px] text-stone-400 hover:border-sky-400/40 hover:text-sky-200"
    >
      {children}
    </button>
  );
}

function AnalyzedBadge({ analyzed }: { analyzed: boolean }) {
  return (
    <span
      className={`shrink-0 rounded-sm border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest ${
        analyzed
          ? "border-emerald-400/30 bg-emerald-400/[0.08] text-emerald-200"
          : "border-stone-700 bg-stone-900/40 text-stone-500"
      }`}
    >
      {analyzed ? "분석됨" : "미분석"}
    </span>
  );
}

function SummaryPanel({
  state,
  selectedCount,
  totalEpisodes,
  totalChars,
  etaSeconds,
  natBalance,
  natTotal,
  balanceAfter,
  natLines,
  platform,
  setPlatform,
  overLimit,
  chunkingDisabled,
  chunkCount,
  error,
  loreNullPrompt,
  extracting,
  analyzing,
}: {
  state: "A" | "B" | "C" | "D" | "E";
  selectedCount: number;
  totalEpisodes: number;
  totalChars: number;
  etaSeconds: number;
  natBalance: number;
  natTotal: number;
  balanceAfter: number;
  natLines: { label: string; nat: number }[];
  platform: string;
  setPlatform: (v: string) => void;
  overLimit: boolean;
  chunkingDisabled: boolean;
  chunkCount: number;
  error: string | null;
  loreNullPrompt: string | null;
  extracting: boolean;
  analyzing: boolean;
}) {
  const insufficient = state === "D";

  return (
    <aside className="flex min-h-0 w-[280px] shrink-0 flex-col gap-4 overflow-y-auto border-l border-stone-800/60 bg-stone-950/60 px-5 py-5">
      {selectedCount === 0 ? (
        <div className="rounded-lg border border-dashed border-stone-700 bg-stone-900/30 px-4 py-10 text-center">
          <p className="font-serif text-[12.5px] text-stone-500">
            왼쪽 목록에서 분석할 회차를 선택해 주세요.
          </p>
        </div>
      ) : (
        <>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-stone-500">
              선택 요약
            </div>
            <div className="mt-1 font-serif text-[36px] font-medium leading-none text-stone-100">
              <span className="tabular-nums">{selectedCount}</span>
              <span className="ml-1 text-[14px] text-stone-500">
                / {totalEpisodes}회차
              </span>
            </div>
            <div className="mt-2 flex flex-col gap-1 text-[11.5px] text-stone-400">
              <div>
                총 글자수{" "}
                <span className="tabular-nums text-stone-200">
                  {totalChars.toLocaleString("ko-KR")}자
                </span>
              </div>
              <div>
                예상 소요{" "}
                <span className="tabular-nums text-stone-200">
                  약 {Math.round(etaSeconds / 60)}분
                </span>
              </div>
              {chunkCount > 1 && (
                <div className="font-mono text-[10px] tracking-wide text-amber-300/85">
                  · {chunkCount}개 청크 분할 (10화 단위)
                </div>
              )}
            </div>
          </div>

          {/* 의제 신규-1+2 (단계 C-2): NULL 분기 inline 안내 (결정 23 옵션 X). */}
          {loreNullPrompt && (
            <div className="rounded-md border border-amber-400/30 bg-amber-400/[0.05] px-3 py-2.5 text-[11.5px] leading-relaxed text-amber-100/95">
              <p className="whitespace-pre-wrap">{loreNullPrompt}</p>
            </div>
          )}

          {/* 단계 D-fixup-1 (결정 33 UX-1 + 34 D-1 + 35 P-1/T-1):
              추출 + 분석 = 통합 "분석 중" UX + 단계 명시 + spinner only. */}
          {(extracting || analyzing) && (
            <div className="flex items-center gap-2.5 rounded-md border border-sky-400/30 bg-sky-400/[0.06] px-3 py-2.5">
              <span
                className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border-2 border-sky-400/30 border-t-sky-300"
                style={{ animation: "na-spin 1.1s linear infinite" }}
                aria-hidden="true"
              />
              <p className="font-serif text-[11.5px] text-sky-100">
                분석 중 —{" "}
                <span className="text-sky-300">
                  {extracting ? "세계관·인물 추출 중" : "분석 진행 중"}
                </span>
                …
              </p>
            </div>
          )}

          <NatCostMeter
            balance={natBalance}
            spend={natTotal}
            after={balanceAfter}
            insufficient={insufficient}
          />

          <div className="rounded-md border border-stone-800/70 bg-stone-900/40 px-4 py-3">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-stone-500">
              NAT 내역
            </div>
            <ul className="flex flex-col gap-1 text-[11.5px]">
              {natLines.map((l, i) => (
                <li
                  key={i}
                  className="flex items-baseline justify-between gap-2 text-stone-400"
                >
                  <span>{l.label}</span>
                  <span className="tabular-nums text-stone-200">
                    +{l.nat}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* 정책 변경: 단일 택1 (범용 포함). 체크박스 폐기, 셀렉트 항상 활성. */}
          <div className="flex flex-col gap-2.5 rounded-md border border-stone-800/70 bg-stone-900/40 px-4 py-3">
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] uppercase tracking-widest text-stone-500">
                플랫폼
              </label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full rounded-md border border-stone-800 bg-stone-900/60 px-3 py-2 font-serif text-[12.5px] text-stone-100 focus:border-sky-400/40 focus:outline-none"
              >
                {PLATFORM_OPTIONS.map((p) => (
                  <option key={p.id} value={p.id} className="bg-stone-900">
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {insufficient && (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-[11.5px] text-rose-200">
              NAT가 부족합니다. 충전 후 다시 시도해 주세요.
            </div>
          )}

          {overLimit && (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-[11.5px] text-rose-200">
              한 번에 최대 {HOLISTIC_MAX_EPISODES}화까지 분석할 수 있습니다.
            </div>
          )}

          {!overLimit && chunkingDisabled && (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-[11.5px] leading-relaxed text-rose-200">
              11회차 이상 일괄분석은 시스템 개선 작업으로 일시 중단되었습니다.
              10회차 이하로 선택해주세요.
            </div>
          )}

          {error && (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-[11.5px] text-rose-200">
              {error}
            </div>
          )}
        </>
      )}
    </aside>
  );
}

function NatCostMeter({
  balance,
  spend,
  after,
  insufficient,
}: {
  balance: number;
  spend: number;
  after: number;
  insufficient: boolean;
}) {
  return (
    <div className="rounded-md border border-stone-800/70 bg-stone-900/40 px-4 py-3">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-stone-500">
        NAT 차감
      </div>
      <div className="grid grid-cols-3 gap-2 text-[11.5px]">
        <div>
          <div className="text-stone-500">잔액</div>
          <div className="mt-0.5 font-mono tabular-nums text-stone-300">
            {balance}
          </div>
        </div>
        <div>
          <div className="text-stone-500">차감</div>
          <div
            className={`mt-0.5 font-mono tabular-nums ${
              insufficient ? "text-rose-300" : "text-sky-300"
            }`}
          >
            −{spend}
          </div>
        </div>
        <div>
          <div className="text-stone-500">실행 후</div>
          <div
            className={`mt-0.5 font-mono tabular-nums ${
              insufficient ? "text-rose-300" : "text-stone-200"
            }`}
          >
            {after}
          </div>
        </div>
      </div>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-stone-800">
        <div
          className={insufficient ? "h-full bg-rose-400" : "h-full bg-sky-400"}
          style={{
            width: `${Math.min(100, Math.round((spend / Math.max(1, balance)) * 100))}%`,
          }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

function OptionToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-[12.5px] text-stone-200">
      <span className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 cursor-pointer accent-sky-400"
        />
        <span className="font-serif">{label}</span>
      </span>
      <span
        className={`font-mono text-[10.5px] tabular-nums ${
          checked ? "text-sky-300" : "text-stone-600"
        }`}
      >
        {checked ? "+1" : "—"} NAT
      </span>
    </label>
  );
}

function FooterActions({
  state,
  onCancel,
  onConfirm,
  onExecute,
  onBackToSelect,
  onTopUp,
  submitting,
  natTotal,
  disabledExecute,
}: {
  state: "A" | "B" | "C" | "D" | "E";
  onCancel: () => void;
  onConfirm: () => void;
  onExecute: () => void;
  onBackToSelect: () => void;
  onTopUp: () => void;
  submitting: boolean;
  natTotal: number;
  disabledExecute: boolean;
}) {
  if (state === "D") {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-3 py-2 text-[12px] text-stone-400 hover:bg-stone-100/[0.04] hover:text-stone-200"
        >
          닫기
        </button>
        <button
          type="button"
          onClick={onTopUp}
          className="rounded-md bg-sky-500 px-4 py-2 text-[12.5px] font-medium text-stone-950 hover:bg-sky-400"
        >
          NAT 충전하러 가기
        </button>
      </div>
    );
  }
  if (state === "C") {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBackToSelect}
          className="rounded-md border border-stone-700 bg-stone-900/40 px-3 py-2 text-[12px] text-stone-300 hover:border-stone-600 hover:text-stone-100"
        >
          ← 다시 선택
        </button>
        <button
          type="button"
          onClick={onExecute}
          disabled={submitting || disabledExecute}
          className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-5 py-2 text-[12.5px] font-medium text-stone-950 hover:bg-amber-400 disabled:opacity-50"
          style={{
            boxShadow:
              "0 0 0 1px oklch(0.66 0.16 60 / 0.4), 0 8px 24px -12px oklch(0.78 0.16 60 / 0.5)",
          }}
        >
          <Sparkles size={12} aria-hidden="true" />
          {submitting ? "실행 중..." : `${natTotal} NAT 차감하고 실행`}
        </button>
      </div>
    );
  }
  // A 또는 B
  const disabled = state === "A" || disabledExecute;
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-md px-3 py-2 text-[12px] text-stone-400 hover:bg-stone-100/[0.04] hover:text-stone-200"
      >
        취소
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={disabled}
        className="rounded-md bg-sky-500 px-4 py-2 text-[12.5px] font-medium text-stone-950 hover:bg-sky-400 disabled:opacity-40"
      >
        실행 확인 →
      </button>
    </div>
  );
}

function LaunchedBody({
  count,
  workId: _workId,
  onBackground,
  onGoBoardgame,
}: {
  count: number;
  workId: number;
  onBackground: () => void;
  onGoBoardgame: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 px-8 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-500/[0.12] ring-1 ring-inset ring-sky-500/30">
        <Sparkles size={20} className="text-sky-300" aria-hidden="true" />
        <span className="absolute inline-flex h-12 w-12 animate-ping rounded-full bg-sky-400/20" />
      </span>
      <div>
        <h3 className="font-serif text-[18px] text-stone-100">
          일괄 분석을 시작했습니다
        </h3>
        <p className="mt-2 text-[12.5px] text-stone-400">
          {count}개 회차를 백그라운드에서 통합 분석합니다. 결과는 리포트
          보관함에서 확인할 수 있습니다.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBackground}
          className="rounded-md border border-stone-700 bg-stone-900/40 px-4 py-2 text-[12.5px] text-stone-300 hover:border-stone-600 hover:text-stone-100"
        >
          닫고 계속 작업하기
        </button>
        <button
          type="button"
          onClick={onGoBoardgame}
          className="rounded-md bg-sky-500 px-4 py-2 text-[12.5px] font-medium text-stone-950 hover:bg-sky-400"
        >
          리포트 보관함 가서 보기 →
        </button>
      </div>
    </div>
  );
}
