// 내 공정표에 얹어 보기 (시안 WSchedule): 이 집 공정마다 수락한 날짜 · 낸 날짜 · 상태를 공사 순서(목공 → 도배)로 한 표에 둔다.
// 겹침 · 시작할 수 있는 날은 API(fit) 값 그대로다. 막대 그림은 날짜를 하루씩 펼쳐야 해서 두지 않는다.
import { Check, Warn } from "@/components/vendors/icons";
import { eunNeun, iGa } from "@/components/vendors/text";
import { tradeLabel } from "@/lib/labels";
import { day } from "@/components/confirm/text";
import { isAccepted, span, stateOf, type TradeDates } from "./text";
import s from "./schedule.module.css";

const ORDER = ["mokgong", "dobae"];

type Props = { trades: string[]; rows: TradeDates[]; current: string };

function datesOf(r: TradeDates | undefined) {
  if (!r) return null;
  if (isAccepted(r) && r.deal.start_date && r.deal.end_date) {
    const now = span(r.deal.start_date, r.deal.end_date);
    // 수락한 뒤 업체가 새 날짜를 올렸으면 지금 → 새 날짜
    return r.proposal ? `${now} → 새 날짜 ${span(r.proposal.start, r.proposal.end)}` : now;
  }
  return r.proposal ? span(r.proposal.start, r.proposal.end) : null;
}

/** 겹침 안내: 겹치면 수락할 수 없고, 아니면 수락한 다른 공정 날짜를 함께 알린다 */
function FitNote({ t, rows, others }: { t: TradeDates; rows: TradeDates[]; others: string[] }) {
  const fit = t.fit;
  // 수락 전 낸 날짜, 또는 수락한 뒤 업체가 올린 새 날짜
  if (!fit || !t.proposal || (isAccepted(t) && t.deal.status !== "scheduled")) return null;
  const tName = tradeLabel(t.deal.trade);
  if (fit.conflicts.length) {
    const can = fit.start_from && fit.end_by
      ? `${eunNeun(tName)} ${day(fit.start_from)}부터 ${day(fit.end_by)} 사이에 할 수 있어요.`
      : fit.start_from ? `${eunNeun(tName)} ${day(fit.start_from)}부터 시작할 수 있어요.`
      : fit.end_by ? `${eunNeun(tName)} ${day(fit.end_by)}까지 끝나야 해요.` : "";
    return (
      <div className={`mj-notice mj-notice-bad mj-num ${s.note}`}>
        <span className={s.noteBad}><Warn /></span>
        <p>
          <b>겹치는 날이 있어 수락할 수 없어요.</b>{" "}
          {iGa(t.deal.vendor_name)} {isAccepted(t) ? "올린 새 날짜" : "낸 날짜"}가 {fit.conflicts.map((c) => `${tradeLabel(c.trade)} 날짜`).join(" · ")}와 겹쳐요.{" "}
          {fit.conflicts.map((c) => `${eunNeun(tradeLabel(c.trade))} ${span(c.start, c.end)}에 해요.`).join(" ")} {can}
        </p>
      </div>
    );
  }
  if (!others.length) return null;
  const done = rows.filter((r) => r.deal.trade !== t.deal.trade && isAccepted(r) && r.deal.start_date && r.deal.end_date);
  const wait = others.filter((o) => !done.some((d) => d.deal.trade === o));
  return (
    <div className={`mj-notice mj-num ${s.note} ${s.noteOk}`}>
      <span className={s.noteOkI}><Check size={18} /></span>
      <p>
        <b>겹치는 날이 없어요.</b>{" "}
        {done.map((d) => `${eunNeun(tradeLabel(d.deal.trade))} ${span(d.deal.start_date!, d.deal.end_date!)}에 해요.`).join(" ")}
        {wait.length ? ` ${eunNeun(wait.map(tradeLabel).join(" · "))} 아직 날짜를 수락하지 않았어요.` : ""}
      </p>
    </div>
  );
}

export function Overlay({ trades, rows, current }: Props) {
  const order = ORDER.filter((t) => trades.includes(t));
  const t = rows.find((r) => r.deal.trade === current);
  const tName = tradeLabel(current);
  return (
    <section aria-labelledby="ov-h" className={s.ov}>
      <h2 id="ov-h" className="mj-h2">내 공정표에 얹어 보기</h2>
      <div className={s.scroll} role="region" tabIndex={0} aria-label="공정별 공사 날짜 표, 옆으로 넘겨 볼 수 있어요">
        <table className={`mj-table mj-num ${s.tbl}`}>
          <caption className="mj-sr">내 공정표에 얹어 본 {tName} 공사 날짜</caption>
          <thead><tr><th scope="col">공정</th><th scope="col">업체</th><th scope="col">공사 날짜</th><th scope="col">상태</th></tr></thead>
          <tbody>
            {order.map((tr) => {
              const r = rows.find((x) => x.deal.trade === tr);
              const st = stateOf(r);
              const dates = datesOf(r);
              const mine = tr === current;
              return (
                <tr key={tr} className={mine ? s.cur : undefined}>
                  <th scope="row">{tradeLabel(tr)}{mine ? <span className="mj-sr"> (지금 보는 공정)</span> : null}</th>
                  <td>{r ? r.deal.vendor_name : <span className="mj-sub">아직 안 정함</span>}</td>
                  <td>{dates ?? <><span aria-hidden="true">—</span><span className="mj-sr">아직 없음</span></>}</td>
                  <td><span className={`mj-st mj-st-${st.tone} ${s.stLine}`}>{st.text}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {t && !t.proposal && !isAccepted(t) ? <p className="mj-small">{tName} 날짜가 오면 이 표에 얹어 보여요.</p> : null}
      {t ? <FitNote t={t} rows={rows} others={order.filter((x) => x !== current)} /> : null}
    </section>
  );
}
