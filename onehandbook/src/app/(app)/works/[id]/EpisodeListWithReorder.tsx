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
import { DeleteEpisodeModal } from "@/components/DeleteEpisodeModal";
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
  // ADR-0031: 프롤로그 분리 — 재정렬 대상 0 + 맨 앞 고정 렌더 사양.
  const prologueEpisode = useMemo(
    () =>
      episodes.find(
        (e) => e.episode_type === "prologue" || e.episode_number === 0,
      ) ?? null,
    [episodes],
  );
  const regularEpisodes = useMemo(
    () =>
      episodes.filter(
        (e) => !(e.episode_type === "prologue" || e.episode_number === 0),
      ),
    [episodes],
  );
  const [editMode, setEditMode] = useState(false);
  const [items, setItems] = useState<EpisodeRow[]>(regularEpisodes);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  // ADR-0032: 편집 모드 안 삭제 — pendingDelete + modal state 사양 영속화.
  const [pendingDelete, setPendingDelete] = useState<EpisodeRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
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

  /**
   * server SELECT 안 episode_number ASC 정렬 사실 정합 → asc = 원본, desc = reverse.
   * ADR-0031 정합:
   *   - 일반 모드 = 프롤로그 (ep=0) 안 정렬 참여 사실 (asc 시 맨 위 / desc 시 맨 아래).
   *   - 편집 모드 = 프롤로그 안 별도 렌더 (sortable 제외, 맨 앞 고정 단독).
   */
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
    // ADR-0031: items = 본편 단독 (프롤로그 = 별도 렌더, 재정렬 대상 0).
    setPreEditSortMode(sortMode);
    setSortMode("asc");
    setItems(regularEpisodes);
    setEditMode(true);
    setToast(null);
  };

  const cancel = () => {
    setItems(regularEpisodes);
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

  // ADR-0032: 편집 모드 삭제 진입 / 확인 / 취소 사양.
  const handleDeleteRequest = (ep: EpisodeRow) => {
    if (isBusy) return;
    setDeleteError(null);
    setPendingDelete(ep);
  };

  const handleDeleteCancel = () => {
    if (deleting) return;
    setPendingDelete(null);
    setDeleteError(null);
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDelete || deleting) return;
    const ep = pendingDelete;
    const epLabel = ep.episode_number === 0 ? "프롤로그" : `${ep.episode_number}화`;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(
        `/api/works/${workId}/episodes/${ep.id}/delete`,
        { method: "POST" },
      );
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        code?: string;
      };
      if (!res.ok || !data.ok) {
        setDeleteError(data.error ?? "삭제에 실패했습니다.");
        return;
      }
      setPendingDelete(null);
      showToast({ kind: "ok", message: `${epLabel} 회차를 삭제했습니다.` });
      router.refresh();
    } catch (e) {
      console.error("[delete_episode] fetch error:", e);
      setDeleteError("네트워크 오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setDeleting(false);
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
          <>
            {/* ADR-0031: 편집 모드 단독 — 프롤로그 = 맨 앞 고정 (sortable 제외). */}
            {prologueEpisode && (
              <EpisodeRows
                episodes={[prologueEpisode]}
                workId={workId}
                latestByEpisode={latestByEpisode}
                editMode
                onDeleteRequest={handleDeleteRequest}
                deleteDisabled={isBusy || deleting}
              />
            )}
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
                  onDeleteRequest={handleDeleteRequest}
                  deleteDisabled={isBusy || deleting}
                />
              </SortableContext>
            </DndContext>
          </>
        ) : (
          /* ADR-0031: 일반 모드 = 프롤로그 (ep=0) 안 정렬 참여 단독 (별도 고정 path 0). */
          <EpisodeRows
            episodes={displayList}
            workId={workId}
            latestByEpisode={latestByEpisode}
          />
        )}
      </div>

      {pendingDelete && (
        <DeleteEpisodeModal
          open
          workId={Number(workId)}
          episodeId={pendingDelete.id}
          episodeNumber={pendingDelete.episode_number}
          isPrologue={
            pendingDelete.episode_type === "prologue" ||
            pendingDelete.episode_number === 0
          }
          // 본편 + 본편 외 나머지 회차 1건 이상 사실 = 재배치 진입 단독 사양.
          willReorder={
            pendingDelete.episode_type !== "prologue" &&
            pendingDelete.episode_number !== 0 &&
            regularEpisodes.length > 1
          }
          loading={deleting}
          error={deleteError}
          onCancel={handleDeleteCancel}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </section>
  );
}
