import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/supabase/appUser";
import { notFound } from "next/navigation";
import { TopBar } from "@/components/shell/TopBar";
import { formatEpisodeLabel } from "@/lib/episodeLabel";
import {
  parseCharacterSettings,
  parseWorldSetting,
} from "@/components/side-panel/parseWorkJson";
import { EpisodeEditForm } from "../[episodeId]/edit/EpisodeEditForm";

/**
 * 새 회차 등록 page — 단계 D-fixup-3 (결정 53 옵션 U-1) 정합.
 *
 * 편집 page UI 정합 통과: EpisodeEditForm mode="new" 재사용.
 * works SELECT 안 world_setting + character_settings 정합 (편집 page 사양).
 *
 * SettingsDrawer 사용 사양:
 * - mode="new" = SettingsDrawer 비활성화 (episodeId 부재, MemoBody UPSERT 정합 부재).
 * - 「설정」 button click → 안내 노출 ("회차 등록 후 사용 가능").
 * - 「등록」 통과 후 = /works/[id]/episodes/[insertedId]/edit redirect →
 *   SettingsDrawer 사용 사양 정합.
 */
export default async function NewEpisodePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { id } = await params;
  const { type: typeParam } = await searchParams;
  const isPrologue = typeParam === "prologue";
  const supabase = await createClient();
  const appUser = await requireAppUser(supabase);

  const { data: work, error: workError } = await supabase
    .from("works")
    .select(
      "id, title, author_id, deleted_at, world_setting, character_settings",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (workError || !work || work.author_id !== appUser.id) {
    notFound();
  }

  // ADR-0030 + 0031 정합: 본편 단독 MAX+1 (프롤로그 = 0 단독, 본편 안 영향 0).
  const { data: maxRow } = await supabase
    .from("episodes")
    .select("episode_number")
    .eq("work_id", id)
    .eq("episode_type", "episode")
    .order("episode_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 프롤로그 = 0 단독, 본편 = MAX+1 사양 영속화.
  const nextEpisodeNumber = isPrologue
    ? 0
    : (maxRow?.episode_number ?? 0) + 1;

  const natBalance = appUser.coin_balance ?? 0;
  const worldSetting = parseWorldSetting(work.world_setting);
  const characterSettings = parseCharacterSettings(work.character_settings);

  return (
    <>
      <TopBar
        breadcrumb={[
          "스튜디오",
          work.title as string,
          "회차",
          formatEpisodeLabel(
            { episode_number: nextEpisodeNumber, title: null },
            { withTitle: false },
          ),
        ]}
        title="새 회차"
        natBalance={natBalance}
      />

      <EpisodeEditForm
        mode="new"
        type={isPrologue ? "prologue" : "episode"}
        workId={work.id as number}
        workTitle={work.title as string}
        episodeNumber={nextEpisodeNumber}
        initialWorld={worldSetting}
        initialCharacters={characterSettings}
      />
    </>
  );
}
