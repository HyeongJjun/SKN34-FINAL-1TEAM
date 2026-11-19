// 홈 '표준견적서 · 견본'(C01 · C40 · D10). 견본 입력을 서버 계산 엔진에 물은 값을 그대로 보여요(lib/api/guest.ts).
// 조건 줄은 평수만(공급 69.4㎡ → 21평, 평은 보여 줄 때만 셈). 폰은 줄 이름만, 웹은 줄 아래 산식까지.
// 합계 밖 줄은 금액을 괄호로 두고 줄 아래에 '합계 밖'을 적어요.
import { Money } from "@/components/ui/Money";
import type { GuestStandard } from "@/lib/api/guest";
import { decText, wonFull } from "@/lib/format";
import { PYEONG_M2 } from "@/lib/guest/info";
import { toQuoteLines } from "@/lib/guest/standard";
import { LINE_STATES, outsideTotal } from "@/lib/labels";
import s from "./home.module.css";

export function SampleQuote({ std }: { std: GuestStandard }) {
  const lines = toQuoteLines(std.lines, std.scope).filter((l) => l.amount != null);
  const pyeong = Math.round(Number(std.area_m2) / PYEONG_M2);
  return (
    <section className={`${s.group} ${s.sample}`} aria-labelledby="sample-t">
      <p id="sample-t" className={s.eb}>표준견적서 · 견본</p>
      <p className={`${s.sub} mj-num`}>{pyeong}평</p>
      <p className={s.sampleBig}>
        <Money value={std.total} size="mid" className={s.phoneOnly} />
        <Money value={std.total} size="big" className={s.webOnlyInline} />
      </p>
      <ul className={s.rows} aria-label="견본 줄">
        {lines.map((l) => {
          const out = l.state ? outsideTotal(l.state) : false;
          const qty = l.qty != null ? `${typeof l.qty === "string" ? decText(l.qty) : l.qty}${l.unit ?? ""}` : "";
          const phone = l.key === "paper" && qty ? `${l.name} ${qty}` : out ? `${l.name} · ${LINE_STATES[l.state!]}` : l.name;
          const detail = out
            ? [LINE_STATES[l.state!], "합계 밖"].join(" · ")
            : [l.note, qty && l.unitPrice != null ? `${qty} × ${wonFull(l.unitPrice)}` : ""].filter(Boolean).join(" · ");
          return (
            <li key={l.key} className={out ? `${s.row} ${s.out}` : s.row}>
              <div className={s.rl}>
                <b><span className={s.phoneOnlyInline}>{phone}</span><span className={s.webOnlyInline}>{l.name}</span></b>
                {detail ? <span className={`${s.webOnlyInline} mj-num`}>{detail}</span> : null}
              </div>
              <span className={`${s.rv} mj-num`}>{out ? `(${wonFull(l.amount!)})` : wonFull(l.amount!)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
