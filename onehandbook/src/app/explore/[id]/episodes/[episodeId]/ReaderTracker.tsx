"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * 로그인 사용자만: 회차 읽기 체류 시간·정주행률 등 reader_actions 기록
 */
export function ReaderTracker({
  workId,
  episodeNumber,
  enabled,
}: {
  workId: number;
  episodeNumber: number;
  enabled: boolean;
}) {
  const startRef = useRef<number | null>(null);
  const sentRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    startRef.current = Date.now();

    return () => {
      if (!enabled || sentRef.current || startRef.current == null) return;
      const sec = Math.floor((Date.now() - startRef.current) / 1000);
      if (sec < 1) return;
      sentRef.current = true;

      const completionRate = sec >= 15 ? 88 : Math.min(95, 20 + sec * 4);
      const dropOff = sec < 8;

      void createClient()
        .from("reader_actions")
        .insert({
          work_id: workId,
          episode_number: episodeNumber,
          session_duration: sec,
          completion_rate: completionRate,
          drop_off: dropOff,
        })
        .then(({ error }) => {
          if (error) console.error("reader_actions insert:", error);
        });
    };
  }, [enabled, workId, episodeNumber]);

  return null;
}
