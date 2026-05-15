"use client";

import { useRouter } from "next/navigation";
import { WorkSelector, type WorkOption } from "@/components/atoms/WorkSelector";

interface WorkDetailHeaderProps {
  workId: string;
  works: WorkOption[];
  genre: string;
  totalEpisodes: number;
}

/**
 * 작품 상세 페이지 헤더 — WorkSelector sm + 메타 라인.
 *
 * useRouter 종속 본질로 server component (page.tsx) 에서 분리.
 */
export function WorkDetailHeader({
  workId,
  works,
  genre,
  totalEpisodes,
}: WorkDetailHeaderProps) {
  const router = useRouter();
  return (
    <div className="min-w-0">
      <WorkSelector
        works={works}
        currentId={workId}
        size="md"
        onChange={(id) => router.push(`/works/${id}`)}
      />
      <p className="mt-2 text-stone-400">
        {genre} · {totalEpisodes}화
      </p>
    </div>
  );
}
