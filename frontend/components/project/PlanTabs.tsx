"use client";
// '막대로 보기 · 날짜별로 보기' 탭 (시안 WPlan). 두 판은 서버가 그려 넘기고 여기서는 어느 판을 보일지만 바꾼다.
// 좁은 화면(720px 이하)에서는 막대 대신 날짜별 표만 보인다(PlanTabs.module.css).
import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import s from "./PlanTabs.module.css";

type Tab = "bars" | "list";

export function PlanTabs({ bars, list, extra }: { bars: ReactNode; list: ReactNode; extra?: ReactNode }) {
  const [tab, setTab] = useState<Tab>("bars");
  const barsTab = useRef<HTMLButtonElement>(null);
  const listTab = useRef<HTMLButtonElement>(null);

  // 화살표 · Home · End로 탭을 옮긴다(탭이 둘이라 어느 쪽이든 다른 탭으로)
  function onKey(e: KeyboardEvent) {
    const to: Tab | null = e.key === "Home" ? "bars" : e.key === "End" ? "list" : e.key === "ArrowLeft" || e.key === "ArrowRight" ? (tab === "bars" ? "list" : "bars") : null;
    if (!to) return;
    e.preventDefault();
    setTab(to);
    (to === "bars" ? barsTab : listTab).current?.focus();
  }

  return (
    <>
      <div className={s.bar}>
        <div role="tablist" aria-label="공정표 보기 방식" className={`mj-tabs ${s.tabs}`} onKeyDown={onKey}>
          <button ref={barsTab} type="button" role="tab" id="pl-tab-bars" aria-controls="pl-bars" aria-selected={tab === "bars"} tabIndex={tab === "bars" ? 0 : -1} onClick={() => setTab("bars")}>막대로 보기</button>
          <button ref={listTab} type="button" role="tab" id="pl-tab-list" aria-controls="pl-list" aria-selected={tab === "list"} tabIndex={tab === "list" ? 0 : -1} onClick={() => setTab("list")}>날짜별로 보기</button>
        </div>
        {extra}
      </div>
      <div id="pl-bars" role="tabpanel" aria-labelledby="pl-tab-bars" className={s.barsPanel} hidden={tab !== "bars"}>{bars}</div>
      <div id="pl-list" role="tabpanel" aria-labelledby="pl-tab-list" className={s.listPanel} hidden={tab !== "list"} tabIndex={0}>{list}</div>
    </>
  );
}
