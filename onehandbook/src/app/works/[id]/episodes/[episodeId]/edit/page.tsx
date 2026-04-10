import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/supabase/appUser";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AppShellHeader } from "@/components/AppShellHeader";
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
    .select("id, title, author_id")
    .eq("id", id)
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

        <h1 className="mb-2 text-2xl font-bold text-zinc-100">
          회차 편집 ({episode.episode_number}화)
        </h1>
        <p className="mb-8 text-zinc-400">{work.title}</p>

        <EpisodeEditForm
          workId={work.id}
          episodeId={episode.id}
          initialTitle={episode.title}
          initialContent={episode.content}
        />
      </main>
    </div>
  );
}
