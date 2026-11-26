// 표준견적서 공정별 줄 · 순서 띠(#193): 목공 → 도배 → 바닥(마루). 바닥은 '준비 중' 자리만 둬요(계산 엔진 · 에이전트는 에이전트 팀 작업).
// 금액은 공정마다 계산 엔진 값 그대로예요. 공정 합계를 화면에서 더하지 않아요.
import { QuoteLines } from "@/components/ui/QuoteLines";
import type { StdView } from "@/lib/guest/standard";
import s from "./standard.module.css";

const ORDER = [{ key: "mokgong", label: "목공" }, { key: "dobae", label: "도배" }, { key: "floor", label: "바닥(마루)" }] as const;

export function TradeOrder({ has }: { has: string[] }) {
  return (
    <ol className={s.order} aria-label="공사 순서">
      {ORDER.map((t, i) => (
        <li key={t.key} className={has.includes(t.key) ? s.orderOn : undefined}>
          <span className="mj-num">{i + 1}</span> {t.label}{t.key === "floor" ? " · 준비 중" : has.includes(t.key) ? "" : " · 안 해요"}
        </li>
      ))}
    </ol>
  );
}

export function TradePartSheets({ parts }: { parts: NonNullable<StdView["parts"]> }) {
  return (
    <>
      {parts.map((p) => (
        <section key={p.trade} className={s.group} aria-labelledby={`std-${p.trade}`}>
          <h2 id={`std-${p.trade}`} className={s.eyebrow}>목공 줄 · 이 공정만의 합계예요</h2>
          <QuoteLines lines={p.lines} totals={{ supply: p.supply, vat: p.vat, total: p.total }} vatSplit caption="목공 표준견적서 줄" />
        </section>
      ))}
      <section className={s.group} aria-labelledby="std-floor">
        <h2 id="std-floor" className={s.eyebrow}>바닥(마루) 줄</h2>
        <p className={s.soonRow}>준비 중이에요. 마루 종류 · 기존 바닥 철거를 고를 수 있게 되면 여기에 줄이 생겨요.</p>
      </section>
    </>
  );
}
