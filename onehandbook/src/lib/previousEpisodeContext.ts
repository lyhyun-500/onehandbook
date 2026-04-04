import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnalysisResult } from "@/lib/ai/types";

const MAX_PREVIOUS_EPISODES = 20;
const MAX_CONTEXT_CHARS = 10_000;

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 20)}…(이하 생략)`;
}

/** 한 회차 분석 result_json에서 짧은 한 줄 요약 */
function summarizeEpisodeAnalysis(
  episodeNumber: number,
  result: AnalysisResult
): string {
  const imp = result.improvement_points?.[0]?.trim();
  const note = result.comparable_note?.trim();
  const bits: string[] = [`${episodeNumber}화 종합 ${result.overall_score}점`];
  const dimEntries = Object.entries(result.dimensions ?? {}).slice(0, 2);
  for (const [name, d] of dimEntries) {
    const c = (d?.comment ?? "").replace(/\s+/g, " ").trim();
    if (c) bits.push(`${name}: ${c.slice(0, 80)}${c.length > 80 ? "…" : ""}`);
  }
  if (imp) bits.push(`개선: ${imp.slice(0, 100)}${imp.length > 100 ? "…" : ""}`);
  else if (note) bits.push(`비교: ${note.slice(0, 80)}`);
  return bits.join(" · ");
}

/**
 * 개별 회차 분석 시, 동일 작품에서 이번 회차보다 앞선 회차들의
 * 저장된 분석(result_json)만 요약해 프롬프트용 문자열을 만듭니다.
 */
export async function buildPreviousEpisodesAnalysisContext(
  supabase: SupabaseClient,
  workId: number,
  currentEpisodeId: number,
  currentEpisodeNumber: number
): Promise<string> {
  if (currentEpisodeNumber <= 1) return "";

  const { data: prevEpsRaw, error: epErr } = await supabase
    .from("episodes")
    .select("id, episode_number")
    .eq("work_id", workId)
    .lt("episode_number", currentEpisodeNumber)
    .order("episode_number", { ascending: false })
    .limit(MAX_PREVIOUS_EPISODES);

  if (epErr || !prevEpsRaw?.length) return "";

  const prevEps = [...prevEpsRaw].reverse();
  const prevIds = prevEps.map((e) => e.id);
  const { data: runs, error: runErr } = await supabase
    .from("analysis_runs")
    .select("episode_id, result_json, created_at")
    .eq("work_id", workId)
    .in("episode_id", prevIds)
    .order("created_at", { ascending: false });

  if (runErr || !runs?.length) return "";

  const latestByEpisode = new Map<number, AnalysisResult>();
  for (const r of runs) {
    const eid = r.episode_id as number;
    if (latestByEpisode.has(eid)) continue;
    const j = r.result_json as unknown;
    if (!j || typeof j !== "object") continue;
    const o = j as AnalysisResult;
    if (typeof o.overall_score !== "number" || !o.dimensions) continue;
    latestByEpisode.set(eid, o);
  }

  const lines: string[] = [];
  for (const ep of prevEps) {
    if (ep.id === currentEpisodeId) continue;
    const res = latestByEpisode.get(ep.id);
    if (!res) continue;
    lines.push(summarizeEpisodeAnalysis(ep.episode_number, res));
  }

  if (lines.length === 0) return "";

  const fromN = prevEps[0]?.episode_number ?? 1;
  const toN = prevEps[prevEps.length - 1]?.episode_number ?? fromN;
  const header =
    fromN === toN
      ? `이전 ${fromN}화 분석 요약`
      : `이전 ${fromN}~${toN}화 흐름 요약`;

  const body = lines.join("\n");
  return truncate(
    `--- 이전 회차 분석 요약 (맥락용·이번 원고 본문은 아님) ---\n${header}:\n${body}\n---`,
    MAX_CONTEXT_CHARS
  );
}
