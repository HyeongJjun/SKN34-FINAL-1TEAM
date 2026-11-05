// 공정 탭 (시안 WCompare .tabs): 이 집 공정만, 옆에 받은 실측 견적서 수. 주소가 바뀌는 링크라 뒤로 가기 · 공유가 그대로 된다.
import Link from "next/link";
import { tradeLabel } from "@/lib/labels";
import s from "./Compare.module.css";

export function CompareTabs({ base, trades, current, counts }: { base: string; trades: string[]; current: string; counts: Record<string, number> }) {
  return (
    <nav className={s.tabs} aria-label="공정">
      {trades.map((t) => (
        <Link key={t} href={`${base}?trade=${t}`} aria-current={t === current ? "page" : undefined}>
          {tradeLabel(t)} <span className={`mj-num ${s.n}`}>실측 견적서 {counts[t] ?? 0}개</span>
        </Link>
      ))}
    </nav>
  );
}
