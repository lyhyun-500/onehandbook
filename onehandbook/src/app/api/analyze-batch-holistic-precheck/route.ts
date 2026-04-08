import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncAppUser } from "@/lib/supabase/appUser";
import { md5Hex } from "@/lib/contentHash";
import type { NatAnalysisOptions } from "@/lib/nat";
import {
  computeWorkAnalysisContextHash,
  workContextAllowsContentUnchanged,
} from "@/lib/analysis/workAnalysisContextHash";
import { isMissingWorkContextHashColumnError } from "@/lib/analysis/analysisResultsWorkContextSupport";

type PrecheckAnalysisResultRow = {
  episode_id: unknown;
  content_hash: unknown;
  created_at: unknown;
  work_context_hash?: unknown;
};

function normalizeWorkId(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "bigint") return Number(raw);
  if (typeof raw === "number" && !Number.isNaN(raw)) return raw;
  if (typeof raw === "string" && raw.trim() !== "") {
    const n = parseInt(raw, 10);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

function parseNatOptions(body: Record<string, unknown>): NatAnalysisOptions {
  const includeLore = body.includeLore !== false;
  const includePlatformOptimization = body.includePlatformOptimization !== false;
  return { includeLore, includePlatformOptimization };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  const rawIds = body.episodeIds;
  if (!Array.isArray(rawIds) || rawIds.length === 0) {
    return NextResponse.json(
      { error: "episodeIds 배열이 필요합니다." },
      { status: 400 }
    );
  }

  const episodeIds = rawIds
    .map((x) => (typeof x === "number" ? x : parseInt(String(x), 10)))
    .filter((n) => !Number.isNaN(n));

  if (episodeIds.length === 0) {
    return NextResponse.json({ error: "유효한 episodeId가 없습니다." }, { status: 400 });
  }

  const appUser = await syncAppUser(supabase);
  if (!appUser) {
    return NextResponse.json({ error: "사용자 정보를 찾을 수 없습니다." }, { status: 403 });
  }

  // ownership check: ensure episodes belong to works owned by appUser
  const { data: eps, error: epErr } = await supabase
    .from("episodes")
    .select("id, content, work_id")
    .in("id", episodeIds);
  if (epErr || !eps || eps.length !== episodeIds.length) {
    return NextResponse.json(
      { error: "회차를 모두 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  const workIds = [
    ...new Set(
      eps
        .map((e) => normalizeWorkId(e.work_id as unknown))
        .filter((n): n is number => n != null)
    ),
  ];
  if (workIds.length === 0) {
    return NextResponse.json(
      { error: "회차에 작품 정보가 없습니다." },
      { status: 400 }
    );
  }
  const { data: works } = await supabase
    .from("works")
    .select("id, author_id")
    .in("id", workIds);
  const ok = (works ?? []).every((w) => w.author_id === appUser.id);
  if (!ok) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  if (workIds.length !== 1) {
    return NextResponse.json(
      { error: "통합 분석 프리체크는 한 작품의 회차만 선택해 주세요." },
      { status: 400 }
    );
  }

  const opts = parseNatOptions(body);
  const { data: workRow, error: workErr } = await supabase
    .from("works")
    .select("id, genre, title, author_id, world_setting, character_settings")
    .eq("id", workIds[0])
    .single();

  if (workErr || !workRow) {
    return NextResponse.json({ error: "작품을 찾을 수 없습니다." }, { status: 404 });
  }

  const workContextHash = computeWorkAnalysisContextHash(workRow, opts.includeLore);

  let rows: PrecheckAnalysisResultRow[] | null = null;
  let rowsErr = null as { message: string } | null;

  const first = await supabase
    .from("analysis_results")
    .select("episode_id, content_hash, work_context_hash, created_at")
    .in("episode_id", episodeIds)
    .order("created_at", { ascending: false })
    .limit(2000);

  rows = first.data as PrecheckAnalysisResultRow[] | null;
  rowsErr = first.error;

  if (rowsErr && isMissingWorkContextHashColumnError(rowsErr)) {
    const second = await supabase
      .from("analysis_results")
      .select("episode_id, content_hash, created_at")
      .in("episode_id", episodeIds)
      .order("created_at", { ascending: false })
      .limit(2000);
    rows = second.data as PrecheckAnalysisResultRow[] | null;
    rowsErr = second.error;
  }
  if (rowsErr) {
    console.warn("analyze-batch-holistic-precheck analysis_results 조회 실패:", rowsErr.message);
  }

  const lastByEp = new Map<
    number,
    { content_hash: string; work_context_hash: string | null }
  >();
  for (const r of rows ?? []) {
    const eid =
      typeof r.episode_id === "number" ? r.episode_id : parseInt(String(r.episode_id), 10);
    if (Number.isNaN(eid)) continue;
    if (lastByEp.has(eid)) continue;
    const ch = r.content_hash;
    const wh = r.work_context_hash;
    if (typeof ch === "string" && ch.length > 0) {
      lastByEp.set(eid, {
        content_hash: ch,
        work_context_hash: typeof wh === "string" && wh.length > 0 ? wh : null,
      });
    }
  }

  const unchangedEpisodeIds: number[] = [];
  for (const e of eps) {
    const eid = e.id as number;
    const content = typeof e.content === "string" ? e.content : "";
    const cur = md5Hex(content);
    const prev = lastByEp.get(eid);
    if (
      prev &&
      prev.content_hash === cur &&
      workContextAllowsContentUnchanged(
        prev.work_context_hash,
        workContextHash
      )
    ) {
      unchangedEpisodeIds.push(eid);
    }
  }

  return NextResponse.json({ unchanged_episode_ids: unchangedEpisodeIds });
}

