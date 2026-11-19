"use client";
// 미디어 쿼리가 맞는지(브라우저 전용). 서버에서 그릴 때는 serverValue(기본 false = 폰)로 보고, 브라우저에서 바로 맞춰요.
import { useSyncExternalStore } from "react";

export function useMedia(query: string, serverValue = false): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", onChange);
      return () => m.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}
