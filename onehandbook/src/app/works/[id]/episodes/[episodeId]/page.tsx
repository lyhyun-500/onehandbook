import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/supabase/appUser";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AppShellHeader } from "@/components/AppShellHeader";

export default async function EpisodeViewPage({
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
    .select("id, episode_number, title, content, created_at")
    .eq("id", episodeId)
    .eq("work_id", id)
    .single();

  if (!episode) {
    notFound();
  }

  const natBalance = appUser.nat_balance ?? 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <AppShellHeader
        email={appUser.email ?? ""}
        natBalance={natBalance}
      />

      <main className="mx-auto max-w-3xl px-6 py-12">
        <Link
          href={`/works/${id}`}
          className="mb-6 inline-block text-sm text-zinc-400 hover:text-zinc-100"
        >
          ← {work.title}으로 돌아가기
        </Link>

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-zinc-100">
            {episode.episode_number}화. {episode.title}
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            {new Date(episode.created_at).toLocaleDateString("ko-KR")}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8">
          <pre className="whitespace-pre-wrap font-sans text-zinc-100 leading-relaxed">
            {episode.content}
          </pre>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={`/works/${id}/episodes/${episodeId}/edit`}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800"
          >
            편집
          </Link>
          <Link
            href={`/works/${id}/analysis?focus=${episode.id}`}
            className="rounded-lg border border-amber-600/50 bg-amber-950/30 px-4 py-2 text-sm text-amber-200 transition-colors hover:bg-amber-950/50"
          >
            이 회차 AI 분석
          </Link>
          <Link
            href={`/works/${id}`}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-500"
          >
            목록으로
          </Link>
        </div>
      </main>
    </div>
  );
}
