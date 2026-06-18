"use client";

import { useRouter } from "next/navigation";
import { ChevronRight, GripVertical, Trash2 } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatEpisodeLabel } from "@/lib/episodeLabel";
import { ScoreText } from "@/components/atoms/ScoreText";
import type { AnalysisRunRow } from "@/lib/analysisSummary";

export interface EpisodeRow {
  id: number;
  episode_number: number;
  episode_type?: "episode" | "prologue";
  title: string;
  content: string;
  created_at: string;
}

interface EpisodeRowsProps {
  episodes: EpisodeRow[];
  workId: string;
  latestByEpisode: Map<number, AnalysisRunRow>;
  /** 편집(드래그) 모드 — true 시 행 click 차단 + drag handle 좌측 prefix 노출 */
  editMode?: boolean;
  /** ADR-0032: 편집 모드 안 row 삭제 요청 callback. editMode 단독 의미. */
  onDeleteRequest?: (ep: EpisodeRow) => void;
  /** ADR-0032: busyJobCount > 0 시 삭제 button disable 사양. */
  deleteDisabled?: boolean;
}

const READ_GRID = "grid-cols-[80px_1fr_90px_80px_70px_70px_40px]";
const EDIT_GRID = "grid-cols-[28px_80px_1fr_90px_80px_70px_70px_40px]";

/**
 * 작품 상세 회차 테이블 행.
 *
 * editMode = false (기본):
 *   - 행 클릭 = 분석 화면 진입.
 *   - 「편집」 button = stopPropagation + 편집 화면 진입.
 *
 * editMode = true (ADR-0030 회차 재정렬):
 *   - 행 click / button click 전부 차단.
 *   - 좌측 prefix 안 GripVertical handle (cursor-grab) 노출.
 *   - @dnd-kit useSortable 안 transform/transition 적용.
 */
export function EpisodeRows({
  episodes,
  workId,
  latestByEpisode,
  editMode = false,
  onDeleteRequest,
  deleteDisabled = false,
}: EpisodeRowsProps) {
  return (
    <>
      {episodes.map((ep) => (
        <EpisodeRowItem
          key={ep.id}
          ep={ep}
          workId={workId}
          latestRun={latestByEpisode.get(ep.id)}
          editMode={editMode}
          onDeleteRequest={onDeleteRequest}
          deleteDisabled={deleteDisabled}
        />
      ))}
    </>
  );
}

function EpisodeRowItem({
  ep,
  workId,
  latestRun,
  editMode,
  onDeleteRequest,
  deleteDisabled,
}: {
  ep: EpisodeRow;
  workId: string;
  latestRun: AnalysisRunRow | undefined;
  editMode: boolean;
  onDeleteRequest?: (ep: EpisodeRow) => void;
  deleteDisabled?: boolean;
}) {
  const router = useRouter();
  // ADR-0031: 프롤로그 = 재정렬 제외 + 맨 앞 고정 (드래그 핸들 미노출 + sortable disabled).
  const isPrologue =
    ep.episode_type === "prologue" || ep.episode_number === 0;
  const sortable = useSortable({
    id: ep.id,
    disabled: !editMode || isPrologue,
  });
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    sortable;

  const score = latestRun?.result_json.overall_score ?? null;
  const analyzed = latestByEpisodeHas(latestRun);
  const chars = ep.content?.length ?? 0;
  const epLabel = formatEpisodeLabel(
    { episode_number: ep.episode_number, title: null },
    { withTitle: false },
  );

  const goAnalysis = () =>
    router.push(`/works/${workId}/episodes/${ep.id}`);
  const goEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/works/${workId}/episodes/${ep.id}/edit`);
  };

  const style: React.CSSProperties = editMode
    ? {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
      }
    : {};

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(editMode ? {} : { role: "button", tabIndex: 0 })}
      onClick={editMode ? undefined : goAnalysis}
      onKeyDown={
        editMode
          ? undefined
          : (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                goAnalysis();
              }
            }
      }
      className={`grid ${editMode ? EDIT_GRID : READ_GRID} ${editMode ? "" : "cursor-pointer"} items-center gap-4 border-b border-stone-800/40 px-4 py-3.5 text-[13px] last:border-b-0 ${editMode ? "" : "focus:outline-none focus:ring-1 focus:ring-inset focus:ring-sky-400/40"} ${isDragging ? "bg-stone-900/60" : ""}`}
    >
      {editMode &&
        (isPrologue ? (
          // 프롤로그 = 재정렬 제외 사양 영속화. handle 영역 안 빈 cell 단독 (grid 정합).
          <div
            className="flex justify-center text-stone-700"
            title="프롤로그는 맨 앞에 고정됩니다"
            aria-label="프롤로그 고정"
          />
        ) : (
          <div
            {...attributes}
            {...listeners}
            className="flex cursor-grab justify-center text-stone-500 hover:text-sky-300 active:cursor-grabbing"
            aria-label={`${epLabel} 순서 변경 핸들`}
          >
            <GripVertical size={14} aria-hidden="true" />
          </div>
        ))}
      <div className="font-mono text-[12px] tabular-nums text-stone-500">
        {epLabel}
      </div>
      <div className="min-w-0">
        <div className="truncate font-serif text-[14px] text-stone-100">
          {ep.title}
        </div>
        <div className="mt-0.5 font-mono text-[10.5px] text-stone-500">
          {new Date(ep.created_at).toLocaleDateString("ko-KR")}
        </div>
      </div>
      <div className="text-right font-mono tabular-nums text-[12px] text-stone-400">
        {chars.toLocaleString("ko-KR")}자
      </div>
      <div className="text-right">
        {score != null ? (
          <ScoreText score={score} size="sm" />
        ) : (
          <span className="font-mono text-[11px] text-stone-600">—</span>
        )}
      </div>
      <div className="flex justify-end">
        {editMode ? (
          // ADR-0032: 편집 모드 안 「편집」 slot 안 휴지통 button 단독 교체 (위험톤).
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteRequest?.(ep);
            }}
            disabled={deleteDisabled}
            aria-label={`${epLabel} 삭제`}
            title={
              deleteDisabled
                ? "분석 중에는 삭제할 수 없습니다"
                : `${epLabel} 삭제`
            }
            className="inline-flex items-center rounded-md border border-rose-500/30 bg-rose-950/30 px-2 py-1 text-rose-300 transition-colors hover:border-rose-500/60 hover:bg-rose-950/50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-rose-500/30 disabled:hover:bg-rose-950/30"
          >
            <Trash2 size={11} aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onClick={goEdit}
            className="inline-flex items-center rounded-md border border-stone-700 bg-stone-900/40 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-stone-300 transition-colors hover:border-sky-400/40 hover:text-sky-200"
          >
            편집
          </button>
        )}
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={
            editMode
              ? undefined
              : (e) => {
                  e.stopPropagation();
                  goAnalysis();
                }
          }
          disabled={editMode}
          className={`inline-flex items-center rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-widest transition-colors disabled:opacity-40 ${
            analyzed
              ? "border-stone-700 bg-stone-900/40 text-stone-300 hover:border-sky-400/40 hover:text-sky-200"
              : "border-sky-400/30 bg-sky-400/[0.08] text-sky-200 hover:border-sky-400/50 hover:bg-sky-400/[0.14]"
          }`}
        >
          {analyzed ? "재분석" : "분석"}
        </button>
      </div>
      <div className="flex justify-end text-stone-600">
        <ChevronRight size={13} aria-hidden="true" />
      </div>
    </div>
  );
}

function latestByEpisodeHas(run: AnalysisRunRow | undefined): boolean {
  return run !== undefined;
}
