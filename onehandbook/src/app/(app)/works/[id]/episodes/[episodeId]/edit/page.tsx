import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/supabase/appUser";
import { notFound } from "next/navigation";
import { TopBar } from "@/components/shell/TopBar";
import {
  parseCharacterSettings,
  parseWorldSetting,
} from "@/components/side-panel/parseWorkJson";
import { formatEpisodeLabel } from "@/lib/episodeLabel";
import { EpisodeEditForm } from "./EpisodeEditForm";

export default async function EpisodeEditPage({
  params,
}: {
  params: Promise<{ id: string; episodeId: string }>;
}) {
  const { id, episodeId } = await params;
  const supabase = await createClient();
  const appUser = await requireAppUser(supabase);

  const { data: work } = await supabase
    .from("works")
    .select(
      "id, title, author_id, deleted_at, world_setting, character_settings",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (!work || work.author_id !== appUser.id) {
    notFound();
  }

  const { data: episode } = await supabase
    .from("episodes")
    .select("id, episode_number, title, content")
    .eq("id", episodeId)
    .eq("work_id", id)
    .single();

  if (!episode) {
    notFound();
  }

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
            { episode_number: episode.episode_number, title: null },
            { withTitle: false },
          ),
        ]}
        title="회차 편집"
        natBalance={natBalance}
      />

      <EpisodeEditForm
        workId={work.id as number}
        workTitle={work.title as string}
        episodeId={episode.id as number}
        episodeNumber={episode.episode_number as number}
        initialTitle={episode.title as string}
        initialContent={episode.content as string}
        initialWorld={worldSetting}
        initialCharacters={characterSettings}
      />
    </>
  );
}
