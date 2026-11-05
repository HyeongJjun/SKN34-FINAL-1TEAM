// 고객 공정표와 맞춰 보기 (시안 WVCalendar): 다른 공정이 고객과 정한 날짜 + 내가 낼 날짜를 하루 한 칸으로 늘어놓는다.
// 칸은 API가 준 날짜의 첫날부터 끝날까지 늘어놓을 뿐이고(calendarSpan), 겹침 · 일하는 날은 API(미리 계산)가 정한다.
// 휴일 칸은 JobOut의 공휴일 · 주말 규칙으로 칠하기만 한다.
import { calendarSpan, dayParts } from "@/lib/format";
import { tradeLabel } from "@/lib/labels";
import { iGa } from "@/components/pro/inbox/text";
import { eunNeun, span, type Other } from "./text";
import s from "./jobs.module.css";

/** 칸이 이보다 많으면(날짜가 멀리 떨어짐) 그림 없이 글로만 보인다 */
const MAX_DAYS = 35;

type Props = {
  trade: string;
  others: Other[];
  /** 내가 낼 날짜 (아직 고르지 않았으면 null) */
  mine: { start: string; end: string } | null;
  /** 겹침 (미리 계산 결과가 있을 때만) */
  clash: boolean;
  holidays: Set<string>;
  weekendOff: boolean;
};

export function FitChart({ trade, others, mine, clash, holidays, weekendOff }: Props) {
  const ends = [...others.flatMap((o) => [o.start, o.end]), ...(mine ? [mine.start, mine.end] : [])];
  const cal = calendarSpan(ends);
  const rows = [
    ...others.map((o) => ({ key: o.trade, label: tradeLabel(o.trade), sub: `${o.vendor_name} · 정해짐`, start: o.start, end: o.end, tone: s.barA })),
    ...(mine ? [{ key: "mine", label: tradeLabel(trade), sub: "내가 낼 날짜", start: mine.start, end: mine.end, tone: clash ? s.barClash : s.barB }] : []),
  ];
  const said = [
    ...others.map((o) => `${iGa(tradeLabel(o.trade))} ${o.vendor_name} 업체와 ${span(o.start, o.end)}에 정해졌어요.`),
    mine ? `내가 낼 ${eunNeun(tradeLabel(trade))} ${span(mine.start, mine.end)}이에요.` : `${tradeLabel(trade)} 날짜는 아직 고르지 않았어요.`,
  ].join(" ");
  const offDay = (d: string) => holidays.has(d) || (weekendOff && ["토", "일"].includes(dayParts(d).w));

  if (cal.length > MAX_DAYS) return <p className="mj-small">{said} 날짜가 멀리 떨어져 그림은 줄였어요.</p>;

  const col = (d: string) => cal.indexOf(d) + 2;
  return (
    <>
      <div className={s.chartBox} role="region" tabIndex={0} aria-label="고객 공정표 그림, 옆으로 넘겨 볼 수 있어요. 같은 내용은 아래 글에 있어요">
        <div className={`mj-num ${s.chart}`} aria-hidden="true"
          style={{ gridTemplateColumns: `132px repeat(${cal.length}, minmax(44px, 1fr))`, gridTemplateRows: `48px repeat(${rows.length}, 54px)`, minWidth: 132 + cal.length * 44 }}>
          {cal.map((d) => offDay(d) ? <span key={`w${d}`} className={s.cOff} style={{ gridColumn: col(d), gridRow: `1 / ${rows.length + 2}` }} /> : null)}
          {cal.map((d) => <span key={`g${d}`} className={s.cGrid} style={{ gridColumn: col(d), gridRow: `1 / ${rows.length + 2}` }} />)}
          <span className={s.cName} style={{ gridRow: 1 }}><span className="mj-small">작업 · {dayParts(cal[0]).m}월</span></span>
          {cal.map((d, i) => {
            const p = dayParts(d);
            return (
              <span key={`h${d}`} className={`${s.cHead} ${offDay(d) ? s.cHeadOff : ""}`} style={{ gridColumn: col(d) }}>
                <b>{i > 0 && p.d === 1 ? `${p.m}.${p.d}` : p.d}</b>{p.w}
              </span>
            );
          })}
          {rows.map((r, j) => (
            <span key={`n${r.key}`} className={s.cName} style={{ gridRow: j + 2 }}><b>{r.label}</b><span className="mj-small">{r.sub}</span></span>
          ))}
          {rows.map((r, j) => (
            <span key={`b${r.key}`} className={`${s.cBar} ${r.tone}`} style={{ gridRow: j + 2, gridColumn: `${col(r.start)} / ${col(r.end) + 1}` }} />
          ))}
        </div>
      </div>
      <p className="mj-sr">고객 공정표: {said}</p>
      <ul className={s.legend} aria-label="공정표 읽는 법">
        <li><span className={`${s.sw} ${s.barA}`} aria-hidden="true" />다른 공정 · 고객과 정한 날짜</li>
        <li><span className={`${s.sw} ${s.barB}`} aria-hidden="true" />{tradeLabel(trade)} · 내가 낼 날짜</li>
        <li><span className={`${s.sw} ${s.barClash}`} aria-hidden="true" />겹치면 빨간 테두리</li>
        <li><span className={`${s.sw} ${s.swOff}`} aria-hidden="true" />쉬는 날</li>
      </ul>
    </>
  );
}
