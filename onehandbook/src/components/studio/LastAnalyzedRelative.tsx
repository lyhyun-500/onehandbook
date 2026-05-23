"use client";

import { useEffect, useState } from "react";
import {
  formatAbsoluteTimeKst,
  formatRelativeTime,
} from "@/lib/formatRelativeTime";

interface LastAnalyzedRelativeProps {
  iso: string;
}

/**
 * 분석 완료 시점 상대 시간 표시 ("X일 전").
 *
 * SSR 시점과 hydration 시점의 시간 차이가 1분 임계를 넘으면 텍스트 mismatch 가능
 * → suppressHydrationWarning 으로 React 경고만 억제. 첫 paint 후 useEffect 가
 * 클라이언트 시계로 한 번 더 계산하여 최신 값 확정.
 *
 * title 속성에 Asia/Seoul 고정 절대 시각 노출 — a11y + 호버 시 정확 시점 확인.
 */
export function LastAnalyzedRelative({ iso }: LastAnalyzedRelativeProps) {
  const [label, setLabel] = useState(() => formatRelativeTime(iso));

  useEffect(() => {
    setLabel(formatRelativeTime(iso));
  }, [iso]);

  return (
    <span suppressHydrationWarning title={formatAbsoluteTimeKst(iso)}>
      {label}
    </span>
  );
}
