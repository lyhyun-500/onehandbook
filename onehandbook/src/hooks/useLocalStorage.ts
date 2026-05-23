"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * localStorage 박은 영속 상태 박음 hook.
 *
 * SSR 호환 패턴 박음:
 * - initial render = initialValue 박음 (server / client 동일 → hydration mismatch 회피)
 * - mount 후 useEffect 박은 hydrate (localStorage 박은 값 박힘 시 갱신)
 * - 초기 깜빡임 가능 (default → localStorage 값) — 영속 상태 박은 정합 위해 trade-off
 *
 * 호출 패턴:
 *   const [layout, setLayout] = useLocalStorage("studio-layout", "card");
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(initialValue);

  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item !== null) {
        setValue(JSON.parse(item) as T);
      }
    } catch (e) {
      console.error(`[useLocalStorage] read failed for "${key}":`, e);
    }
  }, [key]);

  const setValueAndStore = useCallback(
    (newValue: T) => {
      setValue(newValue);
      try {
        window.localStorage.setItem(key, JSON.stringify(newValue));
      } catch (e) {
        console.error(`[useLocalStorage] write failed for "${key}":`, e);
      }
    },
    [key],
  );

  return [value, setValueAndStore];
}
