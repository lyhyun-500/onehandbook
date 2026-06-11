"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { EpisodeRows, type EpisodeRow } from "./EpisodeRows";
import type { AnalysisRunRow } from "@/lib/analysisSummary";

/**
 * 회차 목록 안 편집(드래그) 모드 wrapper — ADR-0030 정합.
 *
 * - 일반 모드: 기존 EpisodeRows 사양 답습 (최신순 정렬).
 * - 편집 모드: 오름차순 (1화 → N화) 정렬 + 좌측 prefix drag handle + 저장/취소 button.
 * - 진행 중 분석 잡 사실 시 = 「순서 편집」 button disable + 안내 (Q7 UI 가드).
 *   본 가드 통과 후 RPC 안 재확인 (Q7 RPC 가드, 이중 안전망).
 * - 저장 = POST /api/works/[workId]/episodes/reorder + router.refresh.
 * - 안내 toast = InquiriesClient 패턴 답습 (자체 useState 단독).
 */
type ToastState = { kind: "ok" | "err"; message: string };

export function EpisodeListWithReorder({
  episodes,
  workId,
  latestByEpisode,
  busyJobCount,
}: {
  /** server 안 ORDER BY episode_number ASC 정렬 사실 정합 */
  episodes: EpisodeRow[];
  workId: string;
  latestByEpisode: Map<number, AnalysisRunRow>;
  /** analysis_jobs WHERE work_id AND status IN (pending,processing) count */
  busyJobCount: number;
}) {
  const router = useRouter();
  const [editMode, setEditMode] = useState(false);
  const [items, setItems] = useState<EpisodeRow[]>(episodes);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  /** 일반 모드 정렬 토글 — desc(최신순) ↔ asc(오래된순). 기본 = desc. */
  const [sortMode, setSortMode] = useState<"desc" | "asc">("desc");
  /** 편집 모드 진입 직전 sortMode 보존 (저장/취소 안 종료 시 복원 사양). */
  const [preEditSortMode, setPreEditSortMode] =
    useState<"desc" | "asc">("desc");

  const isBusy = busyJobCount > 0;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  /** server SELECT 안 episode_number ASC 정렬 사실 정합 → asc = 원본, desc = reverse. */
  const ascList = episodes;
  const descList = useMemo(() => [...episodes].reverse(), [episodes]);
  const displayList = sortMode === "desc" ? descList : ascList;

  const toggleSort = () => {
    if (editMode) return;
    setSortMode((m) => (m === "desc" ? "asc" : "desc"));
  };

  const enterEditMode = () => {
    if (isBusy) return;
    // 편집 진입 시 진입 전 정렬 보존 + asc 강제 (드래그 직관 정합).
    setPreEditSortMode(sortMode);
    setSortMode("asc");
    setItems(episodes);
    setEditMode(true);
    setToast(null);
  };

  const cancel = () => {
    setItems(episodes);
    setSortMode(preEditSortMode);
    setEditMode(false);
    setToast(null);
  };

  const showToast = (state: ToastState, ms = 4500) => {
    setToast(state);
    window.setTimeout(() => setToast(null), ms);
  };

  const save = async () => {
    if (saving) return;
    const orderedEpisodeIds = items.map((ep) => ep.id);
    setSaving(true);
    try {
      const res = await fetch(
        `/api/works/${workId}/episodes/reorder`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderedEpisodeIds }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        code?: string;
      };
      if (!res.ok || !data.ok) {
        const msg =
          data.code === "analysis_in_progress"
            ? "분석 중에는 순서를 변경할 수 없습니다. 완료 후 다시 시도해 주세요."
            : data.error ?? "재정렬에 실패했습니다.";
        showToast({ kind: "err", message: msg });
        return;
      }
      setSortMode(preEditSortMode);
      setEditMode(false);
      showToast({
        kind: "ok",
        message:
          "회차 순서를 저장했습니다. 이후 분석에 새 순서가 반영됩니다 (이미 분석한 회차의 차트는 분석 당시 번호로 표시됩니다).",
        // 안내 사양 = R-2 (frozen mismatch) + R-7 (fold 맥락) 통합
      });
      router.refresh();
    } catch (e) {
      console.error("[reorder] fetch error:", e);
      showToast({
        kind: "err",
        message: "네트워크 오류가 발생했습니다. 다시 시도해 주세요.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems((arr) => {
      const oldIdx = arr.findIndex((e) => e.id === active.id);
      const newIdx = arr.findIndex((e) => e.id === over.id);
      if (oldIdx < 0 || newIdx < 0) return arr;
      return arrayMove(arr, oldIdx, newIdx);
    });
  };

  if (episodes.length === 0) {
    return (
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <h2 className="font-serif text-[16px] font-medium text-stone-100">
              회차
            </h2>
            <span className="font-mono text-[11px] tabular-nums text-stone-500">
              0편
            </span>
          </div>
        </div>
        <div className="rounded-lg border border-dashed border-stone-700 bg-stone-900/30 px-8 py-14 text-center">
          <p className="font-serif text-[13px] text-stone-400">
            등록된 회차가 없습니다.
          </p>
          <Link
            href={`/works/${workId}/episodes/new`}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-sky-500 px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-stone-950 hover:bg-sky-400"
          >
            첫 회차 등록
          </Link>
        </div>
      </section>
    );
  }

  const grid = editMode
    ? "grid-cols-[28px_80px_1fr_90px_80px_70px_70px_40px]"
    : "grid-cols-[80px_1fr_90px_80px_70px_70px_40px]";

  return (
    <section>
      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 left-1/2 z-[80] max-w-[min(calc(100vw-2rem),28rem)] -translate-x-1/2 rounded-xl border px-4 py-3 text-center text-sm font-medium shadow-lg ${
            toast.kind === "ok"
              ? "border-emerald-500/30 bg-emerald-950/95 text-emerald-100"
              : "border-red-500/35 bg-red-950/95 text-red-100"
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <h2 className="font-serif text-[16px] font-medium text-stone-100">
            회차
          </h2>
          <span className="font-mono text-[11px] tabular-nums text-stone-500">
            {episodes.length}편
          </span>
        </div>

        {editMode ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cancel}
              disabled={saving}
              className="rounded-md border border-stone-700 bg-stone-900/40 px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-widest text-stone-300 hover:border-stone-600 hover:text-stone-100 disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-md border border-sky-400/40 bg-sky-400/[0.12] px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-widest text-sky-200 hover:border-sky-400/60 hover:bg-sky-400/[0.18] disabled:opacity-50"
            >
              {saving ? "저장 중…" : "순서 저장"}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={enterEditMode}
              disabled={isBusy}
              title={
                isBusy
                  ? "분석 중에는 순서를 변경할 수 없습니다."
                  : undefined
              }
              className="rounded-md border border-stone-700 bg-stone-900/40 px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-widest text-stone-300 hover:border-sky-400/40 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-stone-700 disabled:hover:text-stone-300"
            >
              순서 편집
            </button>
            <button
              type="button"
              onClick={toggleSort}
              aria-label={
                sortMode === "desc"
                  ? "오래된순으로 정렬"
                  : "최신순으로 정렬"
              }
              className="flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-widest text-stone-400 hover:text-stone-200"
            >
              {sortMode === "desc" ? "최신순" : "오래된순"}{" "}
              <ChevronDown size={10} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {isBusy && !editMode && (
        <div className="mb-3 rounded-md border border-amber-500/30 bg-amber-900/20 px-3 py-2 font-mono text-[11px] text-amber-200">
          분석 중인 회차가 있어 순서를 변경할 수 없습니다. 완료 후 다시 시도해 주세요.
        </div>
      )}

      {editMode && (
        <div className="mb-3 rounded-md border border-sky-400/30 bg-sky-400/[0.08] px-3 py-2 font-mono text-[11px] text-sky-200">
          순서 편집 중에는 1화부터 표시됩니다. 저장 또는 취소 시 원래 정렬로 돌아갑니다.
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-stone-800/60 bg-stone-900/20">
        <div
          className={`grid ${grid} items-center gap-4 border-b border-stone-800/60 bg-stone-950/40 px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-stone-500`}
        >
          {editMode && <div></div>}
          <div>회차</div>
          <div>제목</div>
          <div className="text-right">글자수</div>
          <div className="text-right">점수</div>
          <div className="text-right">편집</div>
          <div className="text-right">분석</div>
          <div></div>
        </div>

        {editMode ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={items.map((e) => e.id)}
              strategy={verticalListSortingStrategy}
            >
              <EpisodeRows
                episodes={items}
                workId={workId}
                latestByEpisode={latestByEpisode}
                editMode
              />
            </SortableContext>
          </DndContext>
        ) : (
          <EpisodeRows
            episodes={displayList}
            workId={workId}
            latestByEpisode={latestByEpisode}
          />
        )}
      </div>
    </section>
  );
}
