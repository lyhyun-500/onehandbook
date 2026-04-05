"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type {
  RealtimePostgresChangesPayload,
  SupabaseClient,
} from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { AnalysisJobListItem } from "@/app/api/analyze/jobs/route";

export type JobStatus = AnalysisJobListItem["status"];

type InAppNotification = {
  id: string;
  jobId: string;
  workId: number;
  episodeId: number;
  kind: "completed" | "failed";
  read: boolean;
  createdAt: number;
};

type ToastItem = {
  id: string;
  message: string;
  action?: { label: string; href: string };
};

function latestByEpisode(jobs: AnalysisJobListItem[]): Map<number, AnalysisJobListItem> {
  const sorted = [...jobs].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
  const map = new Map<number, AnalysisJobListItem>();
  for (const j of sorted) {
    if (!map.has(j.episode_id)) map.set(j.episode_id, j);
  }
  return map;
}

async function analysisJobRowToListItem(
  supabase: SupabaseClient,
  row: Record<string, unknown>
): Promise<AnalysisJobListItem | null> {
  const id = row.id;
  const rawEp = row.episode_id;
  const episode_id =
    typeof rawEp === "number"
      ? rawEp
      : typeof rawEp === "string"
        ? parseInt(rawEp, 10)
        : NaN;
  const status = row.status;
  const updated_at = row.updated_at;
  if (typeof id !== "string" || Number.isNaN(episode_id)) return null;
  if (
    status !== "pending" &&
    status !== "processing" &&
    status !== "completed" &&
    status !== "failed"
  ) {
    return null;
  }
  if (typeof updated_at !== "string") return null;

  const { data: ep } = await supabase
    .from("episodes")
    .select("work_id")
    .eq("id", episode_id)
    .maybeSingle();

  if (!ep?.work_id) return null;

  return {
    id,
    episode_id,
    work_id: ep.work_id,
    status,
    updated_at,
  };
}

type AnalysisJobsContextValue = {
  getLatestJobForEpisode: (episodeId: number) => AnalysisJobListItem | null;
  workHasAnalyzingEpisode: (workId: number) => boolean;
  registerJobStarted: (job: AnalysisJobListItem) => void;
  notifyAnalysisStarted: () => void;
  unreadCount: number;
  notifications: InAppNotification[];
  markNotificationRead: (id: string) => void;
  clearNotification: (id: string) => void;
};

const AnalysisJobsContext = createContext<AnalysisJobsContextValue | null>(null);

export function useAnalysisJobs() {
  const ctx = useContext(AnalysisJobsContext);
  if (!ctx) {
    throw new Error("useAnalysisJobs는 AnalysisJobsProvider 안에서만 사용할 수 있습니다.");
  }
  return ctx;
}

/** Provider 밖(선택적)에서 사용 — 뱃지 전용 */
export function useAnalysisJobsOptional() {
  return useContext(AnalysisJobsContext);
}

export function AnalysisJobsProvider({ children }: { children: React.ReactNode }) {
  const [apiJobs, setApiJobs] = useState<AnalysisJobListItem[]>([]);
  const [optimistic, setOptimistic] = useState<AnalysisJobListItem[]>([]);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const seededRef = useRef(false);
  const prevJobStatusRef = useRef<Map<string, JobStatus>>(new Map());
  const notifiedTransitionRef = useRef<Set<string>>(new Set());

  const mergedJobs = useMemo(() => {
    const byId = new Map<string, AnalysisJobListItem>();
    for (const j of apiJobs) byId.set(j.id, j);
    for (const j of optimistic) {
      const cur = byId.get(j.id);
      if (!cur || new Date(j.updated_at) >= new Date(cur.updated_at)) {
        byId.set(j.id, j);
      }
    }
    return [...byId.values()];
  }, [apiJobs, optimistic]);

  const episodeLatest = useMemo(() => latestByEpisode(mergedJobs), [mergedJobs]);

  const pushToast = useCallback((t: Omit<ToastItem, "id">) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((prev) => [...prev, { ...t, id }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, 7000);
  }, []);

  const emitJobStatusTransition = useCallback(
    (j: AnalysisJobListItem, was: JobStatus | undefined) => {
      const keyDone = `${j.id}:completed`;
      const keyFail = `${j.id}:failed`;

      if (
        j.status === "completed" &&
        was !== "completed" &&
        (was === "pending" || was === "processing") &&
        !notifiedTransitionRef.current.has(keyDone)
      ) {
        notifiedTransitionRef.current.add(keyDone);
        const href = `/works/${j.work_id}/analysis?focus=${j.episode_id}`;
        const nid = `n-${j.id}-completed`;
        setNotifications((n) => {
          if (n.some((x) => x.id === nid)) return n;
          return [
            {
              id: nid,
              jobId: j.id,
              workId: j.work_id,
              episodeId: j.episode_id,
              kind: "completed",
              read: false,
              createdAt: Date.now(),
            },
            ...n,
          ];
        });
        pushToast({
          message: "분석이 완료됐습니다.",
          action: { label: "결과 보기 →", href },
        });
      }

      if (
        j.status === "failed" &&
        was !== "failed" &&
        (was === "pending" || was === "processing") &&
        !notifiedTransitionRef.current.has(keyFail)
      ) {
        notifiedTransitionRef.current.add(keyFail);
        const href = `/works/${j.work_id}/analysis?focus=${j.episode_id}`;
        const nid = `n-${j.id}-failed`;
        setNotifications((n) => {
          if (n.some((x) => x.id === nid)) return n;
          return [
            {
              id: nid,
              jobId: j.id,
              workId: j.work_id,
              episodeId: j.episode_id,
              kind: "failed",
              read: false,
              createdAt: Date.now(),
            },
            ...n,
          ];
        });
        pushToast({
          message: "분석에 실패했습니다. 상세는 분석 페이지에서 확인하세요.",
          action: { label: "이동 →", href },
        });
      }
    },
    [pushToast]
  );

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const removeChannel = () => {
      if (channel) {
        void supabase.removeChannel(channel);
        channel = null;
      }
    };

    const clearJobsState = () => {
      setApiJobs([]);
      seededRef.current = false;
      prevJobStatusRef.current.clear();
      setOptimistic([]);
    };

    async function handleRealtimePayload(
      payload: RealtimePostgresChangesPayload<{ [key: string]: unknown }>
    ) {
      if (payload.eventType === "DELETE") {
        const oldRow = payload.old as Record<string, unknown> | null;
        const id = oldRow?.id;
        if (typeof id !== "string") return;
        setApiJobs((prev) => prev.filter((j) => j.id !== id));
        prevJobStatusRef.current.delete(id);
        return;
      }

      if (payload.eventType !== "INSERT" && payload.eventType !== "UPDATE") {
        return;
      }

      const row = payload.new as Record<string, unknown> | null;
      if (!row) return;

      const item = await analysisJobRowToListItem(supabase, row);
      if (!item || cancelled) return;

      const was = prevJobStatusRef.current.get(item.id);
      if (seededRef.current) {
        emitJobStatusTransition(item, was);
      }
      prevJobStatusRef.current.set(item.id, item.status);

      setApiJobs((prev) => {
        const next = prev.filter((j) => j.id !== item.id);
        next.push(item);
        next.sort(
          (a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );
        return next.slice(0, 300);
      });

      setOptimistic((opt) => opt.filter((o) => o.id !== item.id));
    }

    async function bootstrap() {
      removeChannel();
      if (cancelled) return;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        clearJobsState();
        return;
      }

      const { data: appRow } = await supabase
        .from("users")
        .select("id")
        .eq("auth_id", user.id)
        .maybeSingle();

      if (!appRow || cancelled) {
        clearJobsState();
        return;
      }

      const res = await fetch("/api/analyze/jobs", { cache: "no-store" });
      if (cancelled) return;
      if (res.status === 401) {
        clearJobsState();
        return;
      }
      if (!res.ok) return;

      const data = (await res.json()) as { jobs?: AnalysisJobListItem[] };
      const jobs = data.jobs ?? [];

      setApiJobs(jobs);
      prevJobStatusRef.current.clear();
      for (const j of jobs) {
        prevJobStatusRef.current.set(j.id, j.status);
      }
      seededRef.current = true;
      setOptimistic((opt) => opt.filter((o) => !jobs.some((j) => j.id === o.id)));

      if (cancelled) return;

      const ch = supabase
        .channel(`analysis_jobs:${appRow.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "analysis_jobs",
            filter: `app_user_id=eq.${appRow.id}`,
          },
          (payload) => {
            void handleRealtimePayload(
              payload as RealtimePostgresChangesPayload<{ [key: string]: unknown }>
            );
          }
        )
        .subscribe((status, err) => {
          if (status === "CHANNEL_ERROR" && err) {
            console.warn("analysis_jobs Realtime:", err);
          }
        });

      channel = ch;
    }

    void bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") return;
      if (session?.user) {
        void bootstrap();
      } else {
        removeChannel();
        clearJobsState();
      }
    });

    return () => {
      cancelled = true;
      removeChannel();
      subscription.unsubscribe();
    };
  }, [emitJobStatusTransition]);

  const registerJobStarted = useCallback((job: AnalysisJobListItem) => {
    prevJobStatusRef.current.set(job.id, job.status);
    setOptimistic((o) => {
      const without = o.filter((x) => x.id !== job.id);
      return [job, ...without];
    });
  }, []);

  const notifyAnalysisStarted = useCallback(() => {
    pushToast({ message: "분석이 시작됐습니다." });
  }, [pushToast]);

  const getLatestJobForEpisode = useCallback(
    (episodeId: number) => episodeLatest.get(episodeId) ?? null,
    [episodeLatest]
  );

  const workHasAnalyzingEpisode = useCallback(
    (workId: number) => {
      for (const j of mergedJobs) {
        if (j.work_id !== workId) continue;
        if (j.status === "pending" || j.status === "processing") return true;
      }
      return false;
    },
    [mergedJobs]
  );

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((n) =>
      n.map((x) => (x.id === id ? { ...x, read: true } : x))
    );
  }, []);

  const clearNotification = useCallback((id: string) => {
    setNotifications((n) => n.filter((x) => x.id !== id));
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const value = useMemo<AnalysisJobsContextValue>(
    () => ({
      getLatestJobForEpisode,
      workHasAnalyzingEpisode,
      registerJobStarted,
      notifyAnalysisStarted,
      unreadCount,
      notifications,
      markNotificationRead,
      clearNotification,
    }),
    [
      getLatestJobForEpisode,
      workHasAnalyzingEpisode,
      registerJobStarted,
      notifyAnalysisStarted,
      unreadCount,
      notifications,
      markNotificationRead,
      clearNotification,
    ]
  );

  return (
    <AnalysisJobsContext.Provider value={value}>
      {children}
      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
    </AnalysisJobsContext.Provider>
  );
}

/** AppShellHeaderClient 전용 — 헤더 슬롯에 배치 */
export function HeaderAnalysisBell() {
  const router = useRouter();
  const { unreadCount, notifications, markNotificationRead, clearNotification } =
    useAnalysisJobs();

  return (
    <AnalysisBell
      unreadCount={unreadCount}
      notifications={notifications}
      onNavigate={(href, nid) => {
        markNotificationRead(nid);
        router.push(href);
      }}
      onDismiss={clearNotification}
    />
  );
}

function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div
      className="pointer-events-none fixed bottom-6 left-1/2 z-[80] flex w-[min(100%,24rem)] -translate-x-1/2 flex-col gap-2 px-4"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex flex-col gap-2 rounded-xl border border-zinc-700 bg-zinc-900/95 px-4 py-3 text-sm text-zinc-100 shadow-xl shadow-black/40 backdrop-blur-md"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="leading-snug">{t.message}</p>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              className="shrink-0 rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
              aria-label="닫기"
            >
              ×
            </button>
          </div>
          {t.action && (
            <Link
              href={t.action.href}
              onClick={() => onDismiss(t.id)}
              className="text-sm font-medium text-cyan-400 hover:text-cyan-300"
            >
              {t.action.label}
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
      />
    </svg>
  );
}

function AnalysisBell({
  unreadCount,
  notifications,
  onNavigate,
  onDismiss,
}: {
  unreadCount: number;
  notifications: InAppNotification[];
  onNavigate: (href: string, notificationId: string) => void;
  onDismiss: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const hrefFor = (n: InAppNotification) =>
    `/works/${n.workId}/analysis?focus=${n.episodeId}`;

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800/80 hover:text-cyan-200"
        aria-label="분석 알림"
        aria-expanded={open}
      >
        <BellIcon className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-cyan-500 px-1 text-[10px] font-bold text-zinc-950">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-[60] mt-2 w-[min(calc(100vw-2rem),20rem)] rounded-xl border border-zinc-800 bg-zinc-950/98 py-2 shadow-2xl shadow-black/50 backdrop-blur-md">
          <p className="border-b border-zinc-800 px-3 pb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            분석 알림
          </p>
          {notifications.length === 0 ? (
            <p className="px-3 py-4 text-sm text-zinc-500">새 알림이 없습니다.</p>
          ) : (
            <ul className="max-h-72 overflow-y-auto">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className="border-b border-zinc-800/80 last:border-0"
                >
                  <div className="flex items-start gap-2 px-2 py-2">
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        onNavigate(hrefFor(n), n.id);
                      }}
                      className="min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-zinc-800/80"
                    >
                      <span
                        className={
                          n.kind === "completed"
                            ? "text-emerald-300/95"
                            : "text-red-400/95"
                        }
                      >
                        {n.kind === "completed"
                          ? "분석 완료"
                          : "분석 실패"}
                      </span>
                      <span className="mt-0.5 block text-xs text-zinc-500">
                        회차 #{n.episodeId} · 결과 보기
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDismiss(n.id)}
                      className="shrink-0 rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                      aria-label="알림 삭제"
                    >
                      ×
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
