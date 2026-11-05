// 공정 탭 (시안 WVendors · WVisit .tabs): 이 집 공정만, 옆에 곳 수. 주소가 바뀌는 링크라 뒤로 가기 · 공유가 그대로 된다.
import Link from "next/link";
import { tradeLabel } from "@/lib/labels";
import type { VTrade } from "./text";
import s from "./VTabs.module.css";

export function VTabs({ base, trades, current, counts }: { base: string; trades: VTrade[]; current: VTrade; counts: Partial<Record<VTrade, number>> }) {
  return (
    <nav className={s.tabs} aria-label="공정">
      {trades.map((t) => (
        <Link key={t} href={`${base}?trade=${t}`} aria-current={t === current ? "page" : undefined}>
          {tradeLabel(t)} <span className={`mj-num ${s.n}`}>{counts[t] ?? 0}<span className="mj-sr">곳</span></span>
        </Link>
      ))}
    </nav>
  );
}
