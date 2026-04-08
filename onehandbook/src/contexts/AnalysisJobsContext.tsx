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
import { parseDbInt } from "@/lib/supabase/parseDbInt";
import type { AnalysisJobListItem } from "@/app/api/analyze/jobs/route";
import { AnalysisAsyncUnchangedModal } from "@/components/AnalysisAsyncUnchangedModal";
import {
  isContentUnchangedFailure,
  isUserCancelledFailure,
} from "@/lib/analysis/analysisJobFailureHeuristics";

export type JobStatus = AnalysisJobListItem["status"];

type InAppNotification = {
  id: string;
  jobId: string;
  workId: number;
  episodeId: number;
  jobKind?: "episode" | "holistic_batch";
  kind: "completed" | "failed";
  read: boolean;
  createdAt: number;
};

type ToastItem = {
  id: string;
  message: string;
  action?: { label: string; href: string; jobId?: string };
};

const READ_JOBS_KEY = "ohb_analysis_read_job_outcomes";

function loadReadJobIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(READ_JOBS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function persistReadJobIds(ids: Set<string>) {
  try {
    sessionStorage.setItem(READ_JOBS_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

function jobCoversEpisode(j: AnalysisJobListItem, episodeId: number): boolean {
  if (j.job_kind === "holistic_batch") {
    return (j.ordered_episode_ids ?? []).includes(episodeId);
  }
  return j.episode_id === episodeId;
}

function formatEtaRemaining(job: AnalysisJobListItem): string {
  const est = job.estimated_seconds;
  if (est == null || est <= 0) return "잠시 후 완료 예정";
  const start = new Date(job.created_at).getTime();
  const elapsed = (Date.now() - start) / 1000;
  const left = Math.max(15, Math.round(est - elapsed));
  if (left < 90) return `약 ${left}초 남음`;
  return `약 ${Math.max(1, Math.round(left / 60))}분 남음`;
}

function analysisHref(j: AnalysisJobListItem): string {
  if (j.job_kind === "holistic_batch") {
    return `/works/${j.work_id}/analysis`;
  }
  return `/works/${j.work_id}/analysis?focus=${j.episode_id}`;
}

async function analysisJobRowToListItem(
  supabase: SupabaseClient,
  row: Record<string, unknown>
): Promise<AnalysisJobListItem | null> {
  const id = String(row.id ?? "");
  const rawEp = row.episode_id;
  const episode_id =
    typeof rawEp === "number"
      ? rawEp
      : typeof rawEp === "string"
        ? parseInt(rawEp, 10)
        : NaN;
  const status = row.status;
  const updated_at = row.updated_at;
  const created_at =
    typeof row.created_at === "string" ? row.created_at : updated_at;
  if (!id || Number.isNaN(episode_id)) return null;
  if (
    status !== "pending" &&
    status !== "processing" &&
    status !== "completed" &&
    status !== "failed"
  ) {
    return null;
  }
  if (typeof updated_at !== "string") return null;
  if (typeof created_at !== "string") return null;

  const fromRow =
    typeof row.work_id === "number"
      ? row.work_id
      : row.work_id != null
        ? parseInt(String(row.work_id), 10)
        : NaN;
  let resolvedWorkId: number;
  if (fromRow != null && !Number.isNaN(fromRow)) {
    resolvedWorkId = fromRow;
  } else {
    const { data: ep } = await supabase
      .from("episodes")
      .select("work_id")
      .eq("id", episode_id)
      .maybeSingle();
    const wid = ep?.work_id;
    if (wid == null) return null;
    resolvedWorkId = wid;
  }

  const job_kind =
    row.job_kind === "holistic_batch" ? "holistic_batch" : "episode";
  const payload = (row.payload ?? {}) as Record<string, unknown>;
  const orderedRaw = payload.orderedEpisodeIds;
  const ordered_episode_ids =
    job_kind === "holistic_batch" && Array.isArray(orderedRaw)
      ? orderedRaw
          .map((x) => (typeof x === "number" ? x : parseInt(String(x), 10)))
          .filter((n) => !Number.isNaN(n))
      : [episode_id];

  const estRaw = payload.estimatedSeconds;
  const estimated_seconds =
    typeof estRaw === "number" && !Number.isNaN(estRaw)
      ? estRaw
      : typeof estRaw === "string"
        ? parseInt(estRaw, 10) || null
        : null;

  const fcRaw = payload.failure_code;
  const failure_code =
    typeof fcRaw === "string" && fcRaw.length > 0 ? fcRaw : null;

  const ppct = payload.progressPercent;
  const progress_percent =
    typeof ppct === "number" && !Number.isNaN(ppct)
      ? Math.min(100, Math.max(0, Math.round(ppct)))
      : null;

  const pp = row.progress_phase;
  const progress_phase =
    pp === "received" || pp === "ai_analyzing" || pp === "report_writing"
      ? pp
      : null;

  const holistic_run_id = parseDbInt(row.holistic_run_id);

  const { data: wk } = await supabase
    .from("works")
    .select("title")
    .eq("id", resolvedWorkId)
    .maybeSingle();

  return {
    id,
    episode_id,
    work_id: resolvedWorkId,
    work_title: wk?.title ?? null,
    status,
    updated_at,
    created_at,
    job_kind,
    progress_phase,
    holistic_run_id,
    ordered_episode_ids,
    error_message:
      typeof row.error_message === "string" ? row.error_message : null,
    estimated_seconds,
    failure_code,
    progress_percent,
  };
}

type UnchangedJobNoticeState = {
  /** 병합된 원본 job id들(중복 제거) */
  jobIds: string[];
  workId: number;
  /** 병합된 회차 id들(중복 제거) */
  episodeIds: number[];
  jobKind: "episode" | "holistic_batch";
  /** 병합된 상세 메시지들(중복 제거) */
  details: string[];
};

type AnalysisJobsContextValue = {
  getLatestJobForEpisode: (episodeId: number) => AnalysisJobListItem | null;
  /** 같은 작품 기준, 해당 회차를 포함하는 pending|processing 작업(통합 포함) */
  getActiveJobCoveringEpisode: (
    episodeId: number,
    workId: number
  ) => AnalysisJobListItem | null;
  workHasAnalyzingEpisode: (workId: number) => boolean;
  /** 비동기 작업이 원고 미변경으로 끝났을 때 전역 안내(중복 jobId 무시) */
  showUnchangedJobNotice: (p: NonNullable<UnchangedJobNoticeState>) => void;
  registerJobStarted: (job: AnalysisJobListItem) => void;
  notifyAnalysisStarted: () => void;
  markJobOutcomeRead: (jobId: string) => void;
  /** 진행 중(pending|processing) 작업을 failed로 마무리 — 서버 /api/analyze/jobs/:id/cancel */
  cancelAnalysisJob: (jobId: string) => Promise<void>;
  /** DB와 목록 동기화(Realtime 누락·optimistic 꼬임 복구) */
  refreshAnalysisJobs: () => Promise<void>;
  unreadCount: number;
  /** 알림 패널용 (진행·완료 목록) */
  panelJobs: AnalysisJobListItem[];
  readOutcomeJobIds: ReadonlySet<string>;
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
  const [readOutcomeJobIds, setReadOutcomeJobIds] = useState<Set<string>>(() =>
    typeof window !== "undefined" ? loadReadJobIds() : new Set()
  );
  const [unchangedJobNotices, setUnchangedJobNotices] = useState<
    UnchangedJobNoticeState[]
  >([]);
  const unchangedNoticeShownJobIdsRef = useRef<Set<string>>(new Set());

  const seededRef = useRef(false);
  const prevJobStatusRef = useRef<Map<string, JobStatus>>(new Map());
  const notifiedTransitionRef = useRef<Set<string>>(new Set());
  /** Realtime postgres_changes 에서 filter 미사용 시 행 소유 검증용 */
  const realtimeExpectedAppUserIdRef = useRef<number | null>(null);

  const mergedJobs = useMemo(() => {
    const byId = new Map<string, AnalysisJobListItem>();
    for (const j of apiJobs) byId.set(j.id, j);
    for (const j of optimistic) {
      const cur = byId.get(j.id);
      if (!cur) {
        byId.set(j.id, j);
        continue;
      }
      const curTerminal =
        cur.status === "completed" || cur.status === "failed";
      const optInFlight =
        j.status === "pending" || j.status === "processing";
      if (curTerminal && optInFlight) {
        continue;
      }
      if (new Date(j.updated_at) >= new Date(cur.updated_at)) {
        byId.set(j.id, j);
      }
    }
    return [...byId.values()];
  }, [apiJobs, optimistic]);

  const getLatestJobForEpisode = useCallback(
    (episodeId: number) => {
      let best: AnalysisJobListItem | null = null;
      let bestTs = 0;
      for (const j of mergedJobs) {
        if (!jobCoversEpisode(j, episodeId)) continue;
        const ts = new Date(j.updated_at).getTime();
        if (ts >= bestTs) {
          bestTs = ts;
          best = j;
        }
      }
      return best;
    },
    [mergedJobs]
  );

  const getActiveJobCoveringEpisode = useCallback(
    (episodeId: number, workId: number) => {
      let best: AnalysisJobListItem | null = null;
      let bestTs = 0;
      for (const j of mergedJobs) {
        if (j.work_id !== workId) continue;
        if (j.status !== "pending" && j.status !== "processing") continue;
        if (!jobCoversEpisode(j, episodeId)) continue;
        const ts = new Date(j.updated_at).getTime();
        if (ts >= bestTs) {
          bestTs = ts;
          best = j;
        }
      }
      return best;
    },
    [mergedJobs]
  );

  const showUnchangedJobNotice = useCallback(
    (p: NonNullable<UnchangedJobNoticeState>) => {
      const firstJobId = p.jobIds[0];
      if (firstJobId && unchangedNoticeShownJobIdsRef.current.has(firstJobId)) {
        return;
      }
      if (firstJobId) unchangedNoticeShownJobIdsRef.current.add(firstJobId);

      setUnchangedJobNotices((prev) => {
        const next = [...prev];
        const mergeInto = (idx: number) => {
          const cur = next[idx]!;
          const merged: UnchangedJobNoticeState = {
            ...cur,
            jobIds: Array.from(new Set([...cur.jobIds, ...p.jobIds].filter(Boolean))),
            episodeIds: Array.from(
              new Set([...cur.episodeIds, ...p.episodeIds].filter((x) => typeof x === "number"))
            ),
            details: Array.from(new Set([...cur.details, ...p.details].filter(Boolean))),
          };
          next[idx] = merged;
        };

        // 이미 보여주는(0번) 모달이 같은 workId면 거기에 병합해서 "1번만" 뜨도록
        if (next[0] && next[0].workId === p.workId && next[0].jobKind === p.jobKind) {
          mergeInto(0);
          return next;
        }

        // 큐의 마지막이 같은 workId면 추가 모달 대신 병합
        const lastIdx = next.length - 1;
        if (lastIdx >= 0) {
          const last = next[lastIdx]!;
          if (last.workId === p.workId && last.jobKind === p.jobKind) {
            mergeInto(lastIdx);
            return next;
          }
        }

        next.push(p);
        return next;
      });
    },
    []
  );

  const dismissUnchangedJobNotice = useCallback(() => {
    setUnchangedJobNotices((prev) => prev.slice(1));
  }, []);

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
        const href = analysisHref(j);
        const nid = `n-${j.id}-completed`;
        setNotifications((n) => {
          if (n.some((x) => x.id === nid)) return n;
          return [
            {
              id: nid,
              jobId: j.id,
              workId: j.work_id,
              episodeId: j.episode_id,
              jobKind: j.job_kind,
              kind: "completed",
              read: false,
              createdAt: Date.now(),
            },
            ...n,
          ];
        });
        pushToast({
          message: "분석이 완료됐습니다. 결과 보기 →",
          action: { label: "결과 보기 →", href, jobId: j.id },
        });
      }

      if (
        j.status === "failed" &&
        was !== "failed" &&
        (was === "pending" || was === "processing") &&
        !notifiedTransitionRef.current.has(keyFail)
      ) {
        notifiedTransitionRef.current.add(keyFail);
        const userCancelled = isUserCancelledFailure({
          failure_code: j.failure_code,
          error_message: j.error_message,
        });
        if (userCancelled) {
          return;
        }
        const isUnchanged = isContentUnchangedFailure({
          failure_code: j.failure_code,
          error_message: j.error_message,
        });
        if (isUnchanged) {
          showUnchangedJobNotice({
            jobIds: [j.id],
            workId: j.work_id,
            episodeIds: [j.episode_id],
            jobKind: j.job_kind ?? "episode",
            details: j.error_message ? [j.error_message] : [],
          });
        }
        if (!isUnchanged) {
          const href = analysisHref(j);
          const nid = `n-${j.id}-failed`;
          setNotifications((n) => {
            if (n.some((x) => x.id === nid)) return n;
            return [
              {
                id: nid,
                jobId: j.id,
                workId: j.work_id,
                episodeId: j.episode_id,
                jobKind: j.job_kind,
                kind: "failed",
                read: false,
                createdAt: Date.now(),
              },
              ...n,
            ];
          });
          pushToast({
            message: "분석에 실패했습니다. 상세는 분석 페이지에서 확인하세요.",
            action: { label: "이동 →", href, jobId: j.id },
          });
        }
      }
    },
    [pushToast, showUnchangedJobNotice]
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
      realtimeExpectedAppUserIdRef.current = null;
      setApiJobs([]);
      seededRef.current = false;
      prevJobStatusRef.current.clear();
      setOptimistic([]);
    };

    function rowAppUserId(raw: unknown): number | null {
      if (typeof raw === "number" && Number.isFinite(raw)) return raw;
      if (typeof raw === "string") {
        const n = parseInt(raw, 10);
        return Number.isNaN(n) ? null : n;
      }
      return null;
    }

    async function refetchJobsFromApi() {
      const res = await fetch("/api/analyze/jobs", { cache: "no-store" });
      if (res.status === 401 || !res.ok) return;
      const data = (await res.json()) as { jobs?: AnalysisJobListItem[] };
      const jobs = data.jobs ?? [];
      setApiJobs(jobs);
      prevJobStatusRef.current.clear();
      for (const j of jobs) {
        prevJobStatusRef.current.set(j.id, j.status);
      }
      seededRef.current = true;
      setOptimistic((opt) => opt.filter((o) => !jobs.some((j) => j.id === o.id)));
    }

    async function handleRealtimePayload(
      payload: RealtimePostgresChangesPayload<{ [key: string]: unknown }>
    ) {
      if (payload.eventType === "DELETE") {
        const oldRow = payload.old as Record<string, unknown> | null;
        const id = oldRow?.id;
        if (typeof id !== "string") return;
        const expected = realtimeExpectedAppUserIdRef.current;
        if (expected != null) {
          const uid = rowAppUserId(oldRow?.app_user_id);
          if (uid != null && uid !== expected) return;
        }
        setApiJobs((prev) => prev.filter((j) => j.id !== id));
        prevJobStatusRef.current.delete(id);
        return;
      }

      if (payload.eventType !== "INSERT" && payload.eventType !== "UPDATE") {
        return;
      }

      const row = payload.new as Record<string, unknown> | null;
      if (!row) return;

      const expected = realtimeExpectedAppUserIdRef.current;
      if (expected != null) {
        const uid = rowAppUserId(row.app_user_id);
        if (uid != null && uid !== expected) return;
      }

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

      realtimeExpectedAppUserIdRef.current = appRow.id;

      /**
       * `filter: app_user_id=eq…` 는 일부 Supabase Realtime 조합에서
       * "mismatch between server and client bindings for postgres changes" 를 유발합니다.
       * RLS로 본인 행만 오므로 filter 없이 구독하고, 위에서 app_user_id 로 한 번 더 거릅니다.
       */
      const ch = supabase
        .channel(`analysis_jobs:${appRow.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "analysis_jobs",
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
            void refetchJobsFromApi();
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
    pushToast({ message: "분석이 시작됐습니다 🔔" });
  }, [pushToast]);

  const markJobOutcomeRead = useCallback((jobId: string) => {
    setReadOutcomeJobIds((prev) => {
      const next = new Set(prev);
      next.add(jobId);
      persistReadJobIds(next);
      return next;
    });
  }, []);

  const cancelAnalysisJob = useCallback(
    async (jobId: string) => {
      const res = await fetch(
        `/api/analyze/jobs/${encodeURIComponent(jobId)}/cancel`,
        { method: "POST" }
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        error_message?: string;
      };
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "작업을 중단하지 못했습니다."
        );
      }
      const msg =
        typeof data.error_message === "string"
          ? data.error_message
          : "사용자가 중단했습니다.";
      setApiJobs((prev) =>
        prev.map((j) =>
          j.id === jobId
            ? {
                ...j,
                status: "failed",
                error_message: msg,
                progress_phase: null,
                progress_percent: null,
                failure_code: "USER_CANCELLED",
                updated_at: new Date().toISOString(),
              }
            : j
        )
      );
      setOptimistic((o) => o.filter((x) => x.id !== jobId));
      prevJobStatusRef.current.set(jobId, "failed");
      pushToast({ message: "분석을 중단했습니다." });
    },
    [pushToast]
  );

  const refreshAnalysisJobs = useCallback(async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: appRow } = await supabase
        .from("users")
        .select("id")
        .eq("auth_id", user.id)
        .maybeSingle();
      if (!appRow) return;

      const res = await fetch("/api/analyze/jobs", { cache: "no-store" });
      if (!res.ok) return;

      const data = (await res.json()) as { jobs?: AnalysisJobListItem[] };
      const jobs = data.jobs ?? [];

      setApiJobs(jobs);
      for (const j of jobs) {
        prevJobStatusRef.current.set(j.id, j.status);
      }
      setOptimistic((opt) =>
        opt.filter((o) => {
          const fromApi = jobs.find((j) => j.id === o.id);
          if (!fromApi) return true;
          if (fromApi.status === "completed" || fromApi.status === "failed") {
            return false;
          }
          return true;
        })
      );
    } catch {
      /* ignore */
    }
  }, []);

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
    setNotifications((n) => {
      const hit = n.find((x) => x.id === id);
      if (hit) {
        queueMicrotask(() => {
          setReadOutcomeJobIds((prev) => {
            const s = new Set(prev);
            s.add(hit.jobId);
            persistReadJobIds(s);
            return s;
          });
        });
      }
      return n.map((x) => (x.id === id ? { ...x, read: true } : x));
    });
  }, []);

  const clearNotification = useCallback((id: string) => {
    setNotifications((n) => n.filter((x) => x.id !== id));
  }, []);

  const unreadCount = useMemo(() => {
    const active = mergedJobs.filter(
      (j) => j.status === "pending" || j.status === "processing"
    ).length;
    const outcomeUnread = mergedJobs.filter(
      (j) =>
        (j.status === "completed" || j.status === "failed") &&
        !readOutcomeJobIds.has(j.id) &&
        !(j.status === "failed" && isContentUnchangedFailure(j)) &&
        !(j.status === "failed" && isUserCancelledFailure(j))
    ).length;
    return active + outcomeUnread;
  }, [mergedJobs, readOutcomeJobIds]);

  const panelJobs = useMemo(
    () =>
      [...mergedJobs].sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      ),
    [mergedJobs]
  );

  const value = useMemo<AnalysisJobsContextValue>(
    () => ({
      getLatestJobForEpisode,
      getActiveJobCoveringEpisode,
      workHasAnalyzingEpisode,
      showUnchangedJobNotice,
      registerJobStarted,
      notifyAnalysisStarted,
      markJobOutcomeRead,
      cancelAnalysisJob,
      refreshAnalysisJobs,
      unreadCount,
      panelJobs,
      readOutcomeJobIds,
      notifications,
      markNotificationRead,
      clearNotification,
    }),
    [
      getLatestJobForEpisode,
      getActiveJobCoveringEpisode,
      workHasAnalyzingEpisode,
      showUnchangedJobNotice,
      registerJobStarted,
      notifyAnalysisStarted,
      markJobOutcomeRead,
      cancelAnalysisJob,
      refreshAnalysisJobs,
      unreadCount,
      panelJobs,
      readOutcomeJobIds,
      notifications,
      markNotificationRead,
      clearNotification,
    ]
  );

  return (
    <AnalysisJobsContext.Provider value={value}>
      {children}
      <AnalysisAsyncUnchangedModal
        open={unchangedJobNotices.length > 0}
        jobIds={unchangedJobNotices[0]?.jobIds ?? []}
        workId={unchangedJobNotices[0]?.workId ?? 0}
        focusEpisodeIds={unchangedJobNotices[0]?.episodeIds ?? []}
        detail={
          unchangedJobNotices[0]?.details && unchangedJobNotices[0].details.length > 0
            ? unchangedJobNotices[0].details[0]
            : undefined
        }
        onDismiss={dismissUnchangedJobNotice}
      />
      <ToastStack
        toasts={toasts}
        onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))}
        onMarkJobRead={markJobOutcomeRead}
      />
    </AnalysisJobsContext.Provider>
  );
}

/** AppShellHeaderClient 전용 — 헤더 슬롯에 배치 */
export function HeaderAnalysisBell() {
  const router = useRouter();
  const {
    unreadCount,
    panelJobs,
    readOutcomeJobIds,
    markJobOutcomeRead,
    markNotificationRead,
    cancelAnalysisJob,
    refreshAnalysisJobs,
  } = useAnalysisJobs();

  return (
    <AnalysisBell
      unreadCount={unreadCount}
      panelJobs={panelJobs}
      readOutcomeJobIds={readOutcomeJobIds}
      onCancelJob={cancelAnalysisJob}
      onPanelOpen={refreshAnalysisJobs}
      onNavigate={(href, jobId, notificationId) => {
        if (notificationId) markNotificationRead(notificationId);
        if (jobId) markJobOutcomeRead(jobId);
        router.push(href);
      }}
    />
  );
}

function ToastStack({
  toasts,
  onDismiss,
  onMarkJobRead,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
  onMarkJobRead: (jobId: string) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div
      className="pointer-events-none fixed bottom-6 right-6 z-[80] flex w-[min(calc(100vw-3rem),22rem)] flex-col gap-2"
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
              onClick={() => {
                if (t.action?.jobId) onMarkJobRead(t.action.jobId);
                onDismiss(t.id);
              }}
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

function jobCardTitle(j: AnalysisJobListItem): string {
  const wt = j.work_title?.trim() || "작품";
  if (j.job_kind === "holistic_batch") {
    const n = j.ordered_episode_ids?.length ?? 0;
    return `${wt} · 통합 ${n}개 회차`;
  }
  return `${wt} · 이 화 분석`;
}

function formatKstYYMMDD(iso: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const yy = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "2-digit",
  }).format(d);
  const mm = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
  }).format(d);
  const dd = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    day: "2-digit",
  }).format(d);
  return `${yy}${mm}${dd}`;
}

function JobProgressSteps({ job }: { job: AnalysisJobListItem }) {
  const { status, progress_phase: ph } = job;

  const s1 = "done" as const;
  let s2: "done" | "active" | "wait" = "wait";
  let s3: "done" | "active" | "wait" = "wait";
  let s4: "done" | "active" | "wait" | "fail" = "wait";

  if (status === "pending") {
    s2 = "wait";
    s3 = "wait";
    s4 = "wait";
  } else if (status === "processing") {
    if (ph === "ai_analyzing") {
      s2 = "active";
    } else if (ph === "report_writing") {
      s2 = "done";
      s3 = "active";
    } else {
      s2 = "active";
    }
  } else if (status === "completed") {
    s2 = "done";
    s3 = "done";
    s4 = "done";
  } else if (status === "failed") {
    s2 = "done";
    s3 = ph === "report_writing" ? "done" : "done";
    s4 = "fail";
  }

  const row = (
    label: string,
    mode: "done" | "active" | "wait" | "fail"
  ) => (
    <li className="flex items-center gap-2 text-xs text-zinc-400">
      <span className="w-5 shrink-0 text-center" aria-hidden>
        {mode === "done" && "✅"}
        {mode === "active" && (
          <span className="inline-flex motion-safe:animate-pulse">🔄</span>
        )}
        {mode === "wait" && "⏳"}
        {mode === "fail" && "⚠️"}
      </span>
      <span
        className={
          mode === "active"
            ? "font-medium text-cyan-200/95 motion-safe:animate-pulse"
            : mode === "done"
              ? "text-zinc-300"
              : "text-zinc-500"
        }
      >
        {label}
      </span>
    </li>
  );

  return (
    <ul className="mt-2 space-y-1 border-t border-zinc-800/80 pt-2">
      {row("원고 접수", s1)}
      {row("AI 분석 중", s2)}
      {row("리포트 작성 중", s3)}
      {row("완료", s4)}
    </ul>
  );
}

function AnalysisBell({
  unreadCount,
  panelJobs,
  readOutcomeJobIds,
  onCancelJob,
  onPanelOpen,
  onNavigate,
}: {
  unreadCount: number;
  panelJobs: AnalysisJobListItem[];
  readOutcomeJobIds: ReadonlySet<string>;
  onCancelJob: (jobId: string) => Promise<void>;
  onPanelOpen: () => Promise<void>;
  onNavigate: (href: string, jobId: string | null, notificationId: string | null) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    void onPanelOpen();
  }, [open, onPanelOpen]);

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

  const activeJobs = panelJobs.filter(
    (j) => j.status === "pending" || j.status === "processing"
  );
  const outcomeJobs = panelJobs
    .filter((j) => j.status === "completed" || j.status === "failed")
    .slice(0, 12);

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
        <div className="absolute right-0 top-full z-[60] mt-2 w-[min(calc(100vw-2rem),22rem)] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/50">
          <div className="border-b border-zinc-800 bg-zinc-900/90 px-3 py-2.5">
            <p className="text-sm font-semibold text-zinc-100">분석</p>
            <p className="text-[11px] text-zinc-500">진행 중인 작업과 최근 결과</p>
          </div>
          <div className="max-h-[min(70vh,28rem)] overflow-y-auto">
            <div className="px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                진행 중
              </p>
              {activeJobs.length === 0 ? (
                <p className="py-3 text-sm text-zinc-500">
                  진행 중인 분석이 없습니다
                </p>
              ) : (
                <ul className="space-y-3 pt-1">
                  {activeJobs.map((j) => (
                    <li
                      key={j.id}
                      className="rounded-xl border border-zinc-800/90 bg-zinc-900/40 px-3 py-2.5"
                    >
                      <p className="text-sm font-medium text-zinc-100">
                        {jobCardTitle(j)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-zinc-500">
                        {j.job_kind === "holistic_batch" &&
                        j.progress_percent != null &&
                        j.progress_percent > 0 ? (
                          <>
                            진행 {j.progress_percent}% · {formatEtaRemaining(j)}
                          </>
                        ) : (
                          formatEtaRemaining(j)
                        )}
                      </p>
                      {j.job_kind === "holistic_batch" &&
                        j.progress_percent != null &&
                        j.progress_percent > 0 && (
                          <div
                            className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800"
                            role="progressbar"
                            aria-valuenow={j.progress_percent}
                            aria-valuemin={0}
                            aria-valuemax={100}
                          >
                            <div
                              className="h-full rounded-full bg-cyan-500/90 transition-[width] duration-300"
                              style={{ width: `${j.progress_percent}%` }}
                            />
                          </div>
                        )}
                      <JobProgressSteps job={j} />
                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          disabled={cancellingId === j.id}
                          onClick={async () => {
                            setCancelError(null);
                            setCancellingId(j.id);
                            try {
                              await onCancelJob(j.id);
                              router.refresh();
                            } catch (e) {
                              setCancelError(
                                e instanceof Error
                                  ? e.message
                                  : "중단에 실패했습니다."
                              );
                            } finally {
                              setCancellingId(null);
                            }
                          }}
                          className="rounded-lg border border-zinc-600/80 px-2.5 py-1 text-[11px] font-medium text-zinc-300 transition-colors hover:border-amber-500/40 hover:bg-amber-950/25 hover:text-amber-100 disabled:opacity-50"
                        >
                          {cancellingId === j.id ? "중단 중…" : "중단"}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {cancelError ? (
                <p className="mt-2 text-xs text-red-300/95">{cancelError}</p>
              ) : null}
            </div>

            {outcomeJobs.length > 0 && (
              <div className="border-t border-zinc-800 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  최근 완료
                </p>
                <ul className="space-y-2 pt-1">
                  {outcomeJobs.map((j) => {
                    const read = readOutcomeJobIds.has(j.id);
                    const href = analysisHref(j);
                    const kst = formatKstYYMMDD(j.created_at);
                    return (
                      <li key={j.id}>
                        <div
                          className={`flex flex-col gap-1 rounded-xl border border-zinc-800/80 px-3 py-2 transition-opacity ${
                            read ? "opacity-45" : "opacity-100"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={
                                j.status === "completed"
                                  ? "rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300"
                                  : isContentUnchangedFailure(j)
                                    ? "rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-200/95"
                                    : isUserCancelledFailure(j)
                                      ? "rounded-md bg-zinc-600/25 px-2 py-0.5 text-[10px] font-semibold text-zinc-300"
                                      : "rounded-md bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-300"
                              }
                            >
                              {j.status === "completed"
                                ? "분석 완료"
                                : isContentUnchangedFailure(j)
                                  ? "원고 변경 없음"
                                  : isUserCancelledFailure(j)
                                    ? "사용자 중단"
                                    : "분석 실패"}
                            </span>
                            {kst ? (
                              <span className="text-[10px] tabular-nums text-zinc-500">
                                {kst}
                              </span>
                            ) : null}
                          </div>
                          <p className="text-xs text-zinc-300">{jobCardTitle(j)}</p>
                          <button
                            type="button"
                            onClick={() => {
                              setOpen(false);
                              onNavigate(href, j.id, null);
                            }}
                            className="text-left text-xs font-medium text-cyan-400 hover:text-cyan-300"
                          >
                            결과 보기 →
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
