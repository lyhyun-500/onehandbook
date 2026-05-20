import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/supabase/appUser";
import { notFound } from "next/navigation";
import { TopBar } from "@/components/shell/TopBar";
import { WorkSettingsForm } from "./WorkSettingsForm";
import {
  normalizeCharacterSettings,
  normalizeWorldSetting,
} from "@/lib/works/loreTypes";

export default async function WorkSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const appUser = await requireAppUser(supabase);

  const { data: work } = await supabase
    .from("works")
    .select(
      "id, title, genre, status, synopsis, tags, author_id, world_setting, character_settings, contract_status, management_offer_opt_in, deleted_at"
    )
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (!work || work.author_id !== appUser.id) {
    notFound();
  }

  const natBalance = appUser.coin_balance ?? 0;

  return (
    <>
      <TopBar
        breadcrumb={["스튜디오", work.title]}
        title="작품 설정"
        natBalance={natBalance}
      />

      <WorkSettingsForm
        workId={work.id}
        workTitle={work.title}
        initialTitle={work.title}
        initialGenre={work.genre}
        initialStatus={work.status}
        initialSynopsis={typeof work.synopsis === "string" ? work.synopsis : ""}
        initialContractStatus={
          work.contract_status === "계약" ? "계약" : "미계약"
        }
        initialManagementOfferOptIn={Boolean(work.management_offer_opt_in)}
        initialTags={Array.isArray(work.tags) ? work.tags : []}
        initialWorld={normalizeWorldSetting(work.world_setting)}
        initialCharacters={normalizeCharacterSettings(work.character_settings)}
      />
    </>
  );
}
