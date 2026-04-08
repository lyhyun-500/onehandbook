import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/supabase/appUser";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AppShellHeader } from "@/components/AppShellHeader";
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
      "id, title, genre, status, tags, author_id, world_setting, character_settings"
    )
    .eq("id", id)
    .single();

  if (!work || work.author_id !== appUser.id) {
    notFound();
  }

  const natBalance = appUser.nat_balance ?? 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <AppShellHeader
        email={appUser.email ?? ""}
        natBalance={natBalance}
      />

      <main className="mx-auto max-w-4xl px-6 py-12">
        <Link
          href={`/works/${id}`}
          className="mb-6 inline-block text-sm text-zinc-400 hover:text-zinc-100"
        >
          ← {work.title}으로 돌아가기
        </Link>

        <h1 className="mb-2 text-2xl font-bold text-zinc-100">작품 설정</h1>
        <p className="mb-8 text-zinc-400">{work.title}</p>

        <WorkSettingsForm
          workId={work.id}
          initialTitle={work.title}
          initialGenre={work.genre}
          initialStatus={work.status}
          initialTags={Array.isArray(work.tags) ? work.tags : []}
          initialWorld={normalizeWorldSetting(work.world_setting)}
          initialCharacters={normalizeCharacterSettings(work.character_settings)}
        />
      </main>
    </div>
  );
}
