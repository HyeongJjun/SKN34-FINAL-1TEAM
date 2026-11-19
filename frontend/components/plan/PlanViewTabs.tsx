"use client";
// 확정 공정표 보기 두 가지(사용자 요청 2026-11-19)
//   날짜별로 보기: 날마다 오전 · 오후 줄(지금 형식, 9판 C36)
//   공정별로 보기: 공정 이름이 줄, 날짜가 열인 막대 표(기존 프로젝트 PlanBars와 같은 꼴, 9판 D19 표)
// 처음에는 폭에 맞춰 9판대로 보여요(폰 날짜별 · 웹 공정별). 탭을 누르면 폭과 상관없이 그 보기로 바꿔요.
// 두 보기는 서버가 그려 넘기고, 여기서는 어느 쪽을 보일지만 정해요(날짜 · 칸을 새로 만들지 않아요).
import { useId, useState, useSyncExternalStore, type ReactNode } from "react";
import { TabPanel, Tabs } from "@/components/ui/Tabs";
import s from "./PlanViewTabs.module.css";

type View = "days" | "trades";
const WIDE = "(min-width: 768px)";

function subscribe(onChange: () => void) {
  const m = window.matchMedia(WIDE);
  m.addEventListener("change", onChange);
  return () => m.removeEventListener("change", onChange);
}

export function PlanViewTabs({ days, trades }: { days: ReactNode; trades: ReactNode }) {
  const id = useId();
  // 서버 · 하이드레이션 때는 폭을 몰라서 null(CSS가 폭에 맞춰 한쪽만 보여요)
  const wide = useSyncExternalStore(subscribe, () => window.matchMedia(WIDE).matches, () => null);
  const [picked, setPicked] = useState<View | null>(null);
  const view: View | null = picked ?? (wide === null ? null : wide ? "trades" : "days");

  return (
    <div className={s.wrap}>
      <Tabs
        id={id}
        label="공정표 보기 방식"
        fill
        value={view ?? ""}
        onChange={(k) => setPicked(k as View)}
        items={[
          { key: "days", label: "날짜별로 보기" },
          { key: "trades", label: "공정별로 보기" },
        ]}
      />
      <TabPanel tabsId={id} tabKey="days" active={view !== "trades"} className={view === null ? s.autoDays : undefined}>
        {days}
      </TabPanel>
      <TabPanel tabsId={id} tabKey="trades" active={view !== "days"} className={view === null ? s.autoTrades : undefined}>
        {trades}
      </TabPanel>
    </div>
  );
}
