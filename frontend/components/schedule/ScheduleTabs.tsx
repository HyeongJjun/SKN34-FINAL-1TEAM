// 공정 탭 (시안 WCompare .tabs 모양): 이 집 공정만, 옆에 공사 날짜 상태. 주소가 바뀌는 링크라 뒤로 가기 · 공유가 그대로 된다.
import Link from "next/link";
import { tradeLabel } from "@/lib/labels";
import { stateOf, type TradeDates } from "./text";
import s from "./schedule.module.css";

export function ScheduleTabs({ base, trades, current, rows }: { base: string; trades: string[]; current: string; rows: TradeDates[] }) {
  return (
    <nav className={s.tabs} aria-label="공정">
      {trades.map((t) => {
        const st = stateOf(rows.find((r) => r.deal.trade === t));
        return (
          <Link key={t} href={`${base}?trade=${t}`} aria-current={t === current ? "page" : undefined}>
            {tradeLabel(t)} <span className={`${s.n} ${st.tone === "bad" ? s.nBad : ""}`}>{st.text}</span>
          </Link>
        );
      })}
    </nav>
  );
}
