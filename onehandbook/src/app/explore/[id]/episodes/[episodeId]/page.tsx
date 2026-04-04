import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ReaderTracker } from "./ReaderTracker";

export default async function ExploreEpisodeReadPage({
  params,
}: {
  params: Promise<{ id: string; episodeId: string }>;
}) {
  const { id, episodeId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: work } = await supabase
    .from("works")
    .select("id, title")
    .eq("id", id)
    .single();

  if (!work) {
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

  return (
    <main className="mx-auto max-w-3xl px-6 py-10 sm:py-12">
      {user && (
        <ReaderTracker
          workId={work.id}
          episodeNumber={episode.episode_number}
          enabled
        />
      )}

      <Link
        href={`/explore/${id}`}
        className="mb-8 inline-flex items-center gap-1 text-sm text-cyan-400/90 transition-colors hover:text-cyan-300"
      >
        ← {work.title} 목록으로
      </Link>

      <article>
        <p className="mb-1 text-xs font-medium uppercase tracking-widest text-cyan-400/85">
          회차 읽기
        </p>
        <h1 className="text-2xl font-bold text-zinc-100">
          {episode.episode_number}화. {episode.title}
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          {new Date(episode.created_at).toLocaleDateString("ko-KR")}
        </p>
        {!user && (
          <p className="mt-6 rounded-xl border border-cyan-500/15 bg-cyan-950/20 px-4 py-3 text-sm text-cyan-100/90">
            로그인하면 읽기 기록이 Agent Score에 반영됩니다.
          </p>
        )}
        <div className="mt-8 rounded-xl border border-cyan-500/10 bg-zinc-900/50 p-6 shadow-inner shadow-black/20 sm:p-8">
          <pre className="whitespace-pre-wrap font-sans text-[15px] leading-relaxed text-zinc-200">
            {episode.content}
          </pre>
        </div>
      </article>
    </main>
  );
}
