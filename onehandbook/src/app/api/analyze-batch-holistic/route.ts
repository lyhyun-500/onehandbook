import { createClient } from "@/lib/supabase/server";
import { runHolisticAnalysis } from "@/lib/ai";
import { getProfileConfig } from "@/lib/ai/profileLookup";
import type { AnalysisCharacterSetting, AnalysisWorldSetting } from "@/lib/ai/types";
import { isProviderConfigured } from "@/lib/ai/availability";
import {
  buildHolisticNatBreakdown,
  computeHolisticNatCost,
  countManuscriptChars,
  resolveAnalysisAgentVersion,
  type NatAnalysisOptions,
} from "@/lib/nat";
import { buildHolisticDisplay } from "@/lib/holisticWeightedScore";
import {
  normalizeCharacterSettings,
  normalizeWorldSetting,
} from "@/lib/works/loreTypes";
import {
  MANUSCRIPT_TOO_SHORT_MESSAGE,
  MIN_ANALYSIS_CHARS,
} from "@/lib/manuscriptEligibility";
import { NextResponse } from "next/server";
import { syncAppUser } from "@/lib/supabase/appUser";
import { md5Hex } from "@/lib/contentHash";
import type { HolisticAnalysisResult } from "@/lib/ai/types";

type ConsumeNatRpcResult = {
  ok?: boolean;
  error?: string;
  balance?: number;
  required?: number;
};

function parseNatOptions(body: Record<string, unknown>): NatAnalysisOptions {
  const includeLore = body.includeLore !== false;
  const includePlatformOptimization = body.includePlatformOptimization !== false;
  return { includeLore, includePlatformOptimization };
}

function holisticContentHash(
  orderedIds: number[],
  contents: string[],
  opts: NatAnalysisOptions,
  effectiveAgent: string
): string {
  const body = orderedIds
    .map((id, i) => `${id}:${md5Hex(contents[i] ?? "")}`)
    .join("|");
  return md5Hex(
    `${body}|${effectiveAgent}|${opts.includeLore}|${opts.includePlatformOptimization}`
  );
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
    return NextResponse.json(
      { error: "유효한 episodeId가 없습니다." },
      { status: 400 }
    );
  }

  if (episodeIds.length > 10) {
    return NextResponse.json(
      {
        error:
          "11화 이상은 10화 단위로 나눈 배치 분석 후 병합 API를 사용합니다.",
        code: "HOLISTIC_BATCH_REQUIRED" as const,
      },
      { status: 400 }
    );
  }

  const opts = parseNatOptions(body);
  const requestedVersion =
    typeof body.agentVersion === "string" ? body.agentVersion : "";
  if (!requestedVersion) {
    return NextResponse.json({ error: "agentVersion이 필요합니다." }, { status: 400 });
  }

  const effectiveVersion = resolveAnalysisAgentVersion(
    opts.includePlatformOptimization,
    requestedVersion
  );

  const profile = getProfileConfig(effectiveVersion);
  if (!profile) {
    return NextResponse.json({ error: "알 수 없는 분석 프로필입니다." }, { status: 400 });
  }

  const appUser = await syncAppUser(supabase);
  if (!appUser) {
    return NextResponse.json({ error: "사용자 정보를 찾을 수 없습니다." }, { status: 403 });
  }

  if (!appUser.phone_verified) {
    return NextResponse.json(
      {
        error: "휴대폰 인증 후 이용 가능합니다.",
        code: "PHONE_NOT_VERIFIED" as const,
      },
      { status: 403 }
    );
  }

  const workIdRaw = body.workId;
  const workId =
    typeof workIdRaw === "number"
      ? workIdRaw
      : parseInt(String(workIdRaw ?? ""), 10);
  if (Number.isNaN(workId)) {
    return NextResponse.json({ error: "workId가 필요합니다." }, { status: 400 });
  }

  const { data: work, error: wErr } = await supabase
    .from("works")
    .select("id, genre, author_id, world_setting, character_settings")
    .eq("id", workId)
    .single();

  if (wErr || !work || work.author_id !== appUser.id) {
    return NextResponse.json({ error: "이 작품을 수정할 권한이 없습니다." }, { status: 403 });
  }

  const { data: epRows, error: epErr } = await supabase
    .from("episodes")
    .select("id, episode_number, title, content")
    .eq("work_id", work.id)
    .in("id", episodeIds);

  if (epErr || !epRows || epRows.length !== episodeIds.length) {
    return NextResponse.json(
      { error: "선택한 회차를 모두 찾을 수 없거나 작품과 맞지 않습니다." },
      { status: 400 }
    );
  }

  const byId = new Map(epRows.map((e) => [e.id, e]));
  const ordered = episodeIds.map((id) => byId.get(id)!);

  for (const e of ordered) {
    const n = countManuscriptChars(e.content ?? "");
    if (n < MIN_ANALYSIS_CHARS) {
      return NextResponse.json(
        {
          error: MANUSCRIPT_TOO_SHORT_MESSAGE,
          code: "MANUSCRIPT_TOO_SHORT" as const,
        },
        { status: 400 }
      );
    }
  }

  const totalCombinedChars = ordered.reduce(
    (s, e) => s + countManuscriptChars(e.content ?? ""),
    0
  );

  const cost = computeHolisticNatCost(totalCombinedChars, opts);
  const breakdown = buildHolisticNatBreakdown(
    totalCombinedChars,
    ordered.length,
    opts
  );

  const contents = ordered.map((e) => e.content ?? "");
  /** 스냅샷 지문(저장용). 통합 일괄은 회차별 캐시와 달리 동일 본문이라도 매 요청 새 분석을 수행합니다. */
  const contentHash = holisticContentHash(episodeIds, contents, opts, effectiveVersion);

  if (!isProviderConfigured(profile.provider)) {
    return NextResponse.json(
      {
        error: `${profile.label}에 필요한 API 키가 설정되어 있지 않습니다.`,
      },
      { status: 400 }
    );
  }

  const balance = appUser.nat_balance ?? 0;
  if (balance < cost) {
    return NextResponse.json(
      {
        error: `NAT가 부족합니다. 이번 통합 분석에는 ${cost} NAT가 필요합니다.`,
        code: "INSUFFICIENT_NAT" as const,
        required: cost,
        balance,
        breakdown,
      },
      { status: 402 }
    );
  }

  const wLore = normalizeWorldSetting(work.world_setting);
  const world_setting: AnalysisWorldSetting | undefined =
    opts.includeLore && (wLore.background || wLore.era || wLore.rules)
      ? {
          background: wLore.background || undefined,
          era: wLore.era || undefined,
          rules: wLore.rules || undefined,
        }
      : undefined;

  const character_settings: AnalysisCharacterSetting[] = opts.includeLore
    ? normalizeCharacterSettings(work.character_settings).filter((c) =>
        c.name.trim()
      )
    : [];

  const segments = ordered.map((e) => ({
    episode_number: e.episode_number,
    title: e.title ?? "",
    content: e.content ?? "",
    charCount: countManuscriptChars(e.content ?? ""),
  }));

  try {
    const { result: rawResult, version } = await runHolisticAnalysis(
      {
        manuscript: "",
        genre: work.genre ?? "",
        world_setting,
        character_settings:
          character_settings.length > 0 ? character_settings : undefined,
      },
      segments,
      effectiveVersion
    );

    const orderedForWeight = ordered.map((e) => ({
      episode_number: e.episode_number,
      title: e.title ?? "",
      charCount: countManuscriptChars(e.content ?? ""),
    }));

    const { weightedOverall } = buildHolisticDisplay(rawResult, orderedForWeight);

    const result: HolisticAnalysisResult = {
      ...rawResult,
      overall_score: weightedOverall,
    };

    const optionsRecord = {
      includeLore: opts.includeLore,
      includePlatformOptimization: opts.includePlatformOptimization,
      requested_agent: requestedVersion,
      effective_agent: effectiveVersion,
      total_combined_chars: totalCombinedChars,
      episode_ids: episodeIds,
    };

    const { data: row, error: insErr } = await supabase
      .from("holistic_analysis_runs")
      .insert({
        work_id: work.id,
        episode_ids: episodeIds,
        agent_version: version.id,
        result_json: result,
        nat_cost: cost,
        options_json: optionsRecord,
        content_hash: contentHash,
      })
      .select(
        "id, work_id, episode_ids, agent_version, result_json, nat_cost, created_at"
      )
      .single();

    if (insErr) {
      console.error(insErr);
      if (insErr.code === "42P01" || insErr.message?.includes("holistic_analysis_runs")) {
        return NextResponse.json(
          {
            error:
              "통합 분석 테이블이 아직 준비되지 않았습니다. supabase-migration-holistic-analysis.sql 을 실행해 주세요.",
          },
          { status: 503 }
        );
      }
      return NextResponse.json(
        { error: insErr.message ?? "저장에 실패했습니다." },
        { status: 500 }
      );
    }

    const { data: rpcData, error: rpcErr } = await supabase.rpc("consume_nat", {
      p_amount: cost,
      p_ref_type: "holistic_analysis_run",
      p_ref_id: row.id,
      p_metadata: {
        work_id: work.id,
        episode_ids: episodeIds,
        agent_version: version.id,
      },
    });

    if (rpcErr) {
      console.error(rpcErr);
      await supabase.from("holistic_analysis_runs").delete().eq("id", row.id);
      return NextResponse.json(
        { error: "NAT 차감에 실패했습니다. 잠시 후 다시 시도해 주세요." },
        { status: 500 }
      );
    }

    const rpc = rpcData as ConsumeNatRpcResult;
    if (!rpc?.ok) {
      await supabase.from("holistic_analysis_runs").delete().eq("id", row.id);
      return NextResponse.json(
        {
          error: `NAT가 부족합니다. 이번 통합 분석에는 ${cost} NAT가 필요합니다.`,
          code: "INSUFFICIENT_NAT" as const,
          required: rpc?.required ?? cost,
          balance: rpc?.balance ?? balance,
          breakdown,
        },
        { status: 402 }
      );
    }

    return NextResponse.json({
      holistic: row,
      nat: { spent: cost, balance: rpc.balance },
      breakdown,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "통합 분석에 실패했습니다.";
    console.error(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
