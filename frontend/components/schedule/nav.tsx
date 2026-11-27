"use client";
// 공사 화면 조각이 다른 화면으로 넘어갈 때(공정표 · 리뷰 · 채팅 · 공사 날짜 · 공사 보기) 어디로 갈지.
// 재재 화면 창(Windows) 안에서는 창만 바꾸고(#222 리뷰: 재재 화면 밖으로 나가지 않게), 공사 일정 화면에서는 그 주소로 가요.
import { createContext, useContext, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";

export type ScheduleGo = { kind: "plan" } | { kind: "review" } | { kind: "chat"; threadId: string | null } | { kind: "dates" } | { kind: "project" };

const Go = createContext<((to: ScheduleGo) => void) | null>(null);
export const ScheduleGoProvider = Go.Provider;
/** 재재 화면 창 안이면 창을 바꾸는 함수, 아니면 null(주소로 가요) */
export const useScheduleGo = () => useContext(Go);

/** 주소 단추(공사 화면) · 창 바꾸기 단추(재재 화면 창) */
export function GoButton({ to, href, children }: { to: ScheduleGo; href: string; children: ReactNode }) {
  const go = useScheduleGo();
  return go ? <Button variant="text" arrow onClick={() => go(to)}>{children}</Button> : <Button variant="text" arrow href={href}>{children}</Button>;
}
