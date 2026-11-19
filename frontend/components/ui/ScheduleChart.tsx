// 공정표 칸(design-system 3.3 ScheduleChart · 9판 C08 예상 · C36 · D19 확정) + 업체 일정 반나절 칸(V08 · D14).
// 날 · 칸은 API(계산 엔진)가 준 그대로 그려요. 조각은 날짜를 세거나 만들지 않고, 붙어 있는 같은 칸을 한 막대로 잇기만 해요.
//   웹(≥ 768): 표 — 줄(공정 · 업체 팀) × 열(날, half면 오전 · 오후). 쉬는 날 열은 흐리게, 오늘은 머리에 '오늘'. 넓으면 옆으로 넘김 상자.
//   폰(< 768): 날마다 세로 목록(C36) — 칸이 있는 날과 쉬는 날(흐린 한 줄)만. heads면 V08처럼 '오늘 · 12월 15일(화)' 날짜 묶음 머리 + 줄(쉬는 날은 빼요).
// 건조 · 청소 칸(엔진이 도배 뒤에 늘 붙여요)은 D22 B대로 기본 숨김이에요. 팀이 정하면 showAfter로 켜요.
// "use client"가 아니라 서버 화면에서 바로 그려요(칸 링크는 Next Link).
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { HALF_LABEL, dateLong, dateShort, dateSpoken, dayParts, dayWord, type Half } from "@/lib/format";
import { ScrollBox } from "./ScrollBox";
import { StateTag } from "./StateTag";
import s from "./ScheduleChart.module.css";

/** 칸 종류: 공사 · 자연 건조 · 입주 청소 · (업체 일정) 확정 · 잡아 둠 · 바꾸는 중(수락 기다림) */
export type ChartKind = "work" | "dry" | "clean" | "booked" | "hold" | "pending";
export type ChartCell = {
  /** 'YYYY-MM-DD'(API 값) */
  day: string;
  /** 반나절. 없으면 하루 전체(오전 · 오후) */
  half?: Half;
  kind?: ChartKind;
  /** 막대 글(이어진 막대의 첫 칸에만 보여요). 없으면 줄 이름. 예: '도배' · '상계동 69.4㎡' */
  label?: string;
  /** 막대 글 뒤 덧말(웹 표 · 날짜 묶음 줄 아래): '2일' · '실측 · 빈 집' */
  note?: string;
  /** 누르면 갈 곳(업체 일정: 실측 · 공사 한 건) */
  href?: string;
};
export type ChartRow = { key: string; name: string; sub?: string; cells: ChartCell[] };
export type ChartDay = { day: string; off?: boolean; holiday?: string | null };

const KIND_WORD: Record<ChartKind, string> = { work: "공사", dry: "자연 건조", clean: "입주 청소", booked: "확정", hold: "잡아 둠", pending: "바꾸는 중" };
const KIND_TONE: Partial<Record<ChartKind, "ok" | "wait">> = { booked: "ok", hold: "wait", pending: "wait" };
const AFTER: ChartKind[] = ["dry", "clean"];

type Col = { day: ChartDay; half?: Half };

export function ScheduleChart({ caption, days, rows, half, today, labelHead = "공정", showAfter, legend, note, showCaption, heads, restHead = "그 뒤", view = "auto" }: {
  /** 표 · 목록 이름(읽기용): '확정 공정표' · '1월 4일 주 일정' */
  caption: string;
  /** 보기: auto 폭에 맞춰(폰 목록 · 웹 표) · list 늘 날짜별 목록 · table 늘 표(공정이 줄, 날짜가 열. 폰은 옆으로 넘겨요) */
  view?: "auto" | "list" | "table";
  /** 열이 될 날(API가 준 순서 · 쉬는 날 포함). 보일 날만 넘겨요 */
  days: ChartDay[];
  rows: ChartRow[];
  /** 열을 오전 · 오후로 나눠요(D19 · 업체 일정) */
  half?: boolean;
  /** 서버가 준 오늘('YYYY-MM-DD') */
  today?: string;
  /** 첫 열 머리: '공정' · '팀' */
  labelHead?: string;
  /** 건조 · 청소 칸도 보여요(D22: 기본 숨김) */
  showAfter?: boolean;
  /** 표 아래 범례 */
  legend?: (ChartKind | "off")[];
  /** 표 아래 한 줄(계산 방식 안내) */
  note?: ReactNode;
  showCaption?: boolean;
  /** 폰 목록을 날짜 묶음 머리로(V08): "day" 날마다 '오늘 · 12월 15일(화)'(모레까지 말 붙음) · "near" 오늘 · 내일만 따로, 그 뒤 날은 restHead 한 묶음(줄에 날짜). today가 있어야 '오늘' · '내일'이 붙어요 */
  heads?: "day" | "near";
  /** heads="near"의 나머지 묶음 이름: '이번 주'(업체 일정) */
  restHead?: string;
}) {
  const shown = rows
    .map((r) => ({ ...r, cells: showAfter ? r.cells : r.cells.filter((c) => !AFTER.includes(c.kind ?? "work")) }))
    .filter((r, i) => r.cells.length > 0 || rows[i].cells.length === 0);
  const cols: Col[] = half ? days.flatMap((d) => [{ day: d, half: "am" as const }, { day: d, half: "pm" as const }]) : days.map((d) => ({ day: d }));

  const cellAt = (r: ChartRow, c: Col) =>
    r.cells.find((x) => x.day === c.day.day && (c.half ? x.half === c.half || !x.half : true)) ?? null;
  const sameRun = (a: ChartCell | null, b: ChartCell | null) =>
    !!a && !!b && (a.kind ?? "work") === (b.kind ?? "work") && a.label === b.label && a.href === b.href && (half || (!a.half && !b.half));
  const textOf = (r: ChartRow, c: ChartCell) => c.label ?? r.name;
  const dayName = (d: ChartDay) => [dateSpoken(d.day), d.off ? "쉬는 날" : null, d.holiday ?? null, d.day === today ? "오늘" : null].filter(Boolean).join(", ");
  const md = (iso: string) => { const p = dayParts(iso); return { md: `${p.m}.${p.d}`, w: p.w }; };

  const bar = (r: ChartRow, c: ChartCell, wide: boolean) => {
    const kind = c.kind ?? "work";
    const text = textOf(r, c);
    const inner = (
      <>
        <span className={s.barText}>{text}{c.note ? <span className={s.note}> · {c.note}</span> : null}</span>
        {kind !== "work" && !text.includes(KIND_WORD[kind]) ? <span className="mj-sr">, {KIND_WORD[kind]}</span> : null}
      </>
    );
    const cls = [s.bar, s[kind], !wide && c.half ? s[c.half] : null].filter(Boolean).join(" ");
    // 막대는 32px로 그리고, 누를 곳은 44px 링크가 막대를 감싸요
    return c.href
      ? <Link href={c.href} className={s.barLink} title={text}><span className={cls}>{inner}</span></Link>
      : <span className={cls} title={text}>{inner}</span>;
  };

  // 줄마다: 붙어 있는 같은 칸은 한 칸(colSpan)으로 이어요
  const bodyRow = (r: ChartRow) => {
    const out: ReactNode[] = [];
    for (let i = 0; i < cols.length; ) {
      const col = cols[i];
      const c = cellAt(r, col);
      const off = col.day.off ? s.off : undefined;
      if (!c) { out.push(<td key={i} className={[off, col.half === "pm" ? s.pm : null].filter(Boolean).join(" ") || undefined} />); i += 1; continue; }
      let n = 1;
      while (i + n < cols.length && sameRun(c, cellAt(r, cols[i + n]))) n += 1;
      out.push(<td key={i} colSpan={n > 1 ? n : undefined} className={[s.filled, c.href ? s.linked : null, off].filter(Boolean).join(" ")}>{bar(r, c, half || n > 1 || !c.half)}</td>);
      i += n;
    }
    return out;
  };

  // 폰 날짜 묶음(heads): 날마다 '오늘 · 12월 15일(화)'(day) 또는 오늘 · 내일만 따로 + 나머지 한 묶음(near, V08)
  const groups = () => {
    type It = { r: ChartRow; c: ChartCell; d: ChartDay };
    const out: { key: string; head: string; dated: boolean; items: It[] }[] = [];
    for (const d of days) {
      const items = shown.flatMap((r) => r.cells.filter((c) => c.day === d.day).map((c) => ({ r, c, d })))
        .sort((a, b) => (a.c.half === "pm" ? 1 : 0) - (b.c.half === "pm" ? 1 : 0));
      if (!items.length) continue;
      const word = today ? dayWord(d.day, today) : null;
      if (heads === "near" && word !== "오늘" && word !== "내일") {
        const rest = out.find((g) => g.key === "rest");
        if (rest) rest.items.push(...items);
        else out.push({ key: "rest", head: restHead, dated: true, items });
        continue;
      }
      out.push({ key: d.day, head: `${word ? `${word} · ` : ""}${dateLong(d.day, today)}`, dated: false, items });
    }
    return out;
  };

  // 반나절 칸 48(누르는 막대 44 + 칸 여백), 날 칸 72 — 이보다 좁아지면 옆으로 넘겨요
  const tableMin = 150 + cols.length * (half ? 48 : 72);

  return (
    <div className={[s.wrap, view === "list" ? s.vList : view === "table" ? s.vTable : null].filter(Boolean).join(" ")}>
      <div className={s.tableBox}>
        <ScrollBox label={caption}>
          <table className={s.table} style={{ "--sc-min": `${tableMin}px` } as CSSProperties}>
            <caption className={showCaption ? s.caption : "mj-sr"}>{caption}</caption>
            <colgroup>
              <col className={s.colLabel} />
              {cols.map((c, i) => <col key={i} />)}
            </colgroup>
            <thead>
              <tr>
                <th scope="col" rowSpan={half ? 2 : 1} className={s.l}>{labelHead}</th>
                {days.map((d) => {
                  const p = md(d.day);
                  return (
                    <th key={d.day} scope="col" colSpan={half ? 2 : 1} className={[s.dh, d.off ? s.off : null, d.day === today ? s.today : null].filter(Boolean).join(" ")}>
                      <time dateTime={d.day} aria-label={dayName(d)}>{p.md}({p.w})</time>
                      {d.holiday ? <span className={s.hol} aria-hidden="true">{d.holiday}</span> : d.day === today ? <span className={s.todayTag} aria-hidden="true">오늘</span> : null}
                    </th>
                  );
                })}
              </tr>
              {half ? (
                <tr>
                  {cols.map((c, i) => <th key={i} scope="col" className={[s.hh, c.day.off ? s.off : null, c.half === "pm" ? s.pm : null].filter(Boolean).join(" ")}>{HALF_LABEL[c.half!]}</th>)}
                </tr>
              ) : null}
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.key}>
                  <th scope="row" className={s.l}>
                    <b>{r.name}</b>
                    {r.sub ? <span className={s.sub}>{r.sub}</span> : null}
                  </th>
                  {bodyRow(r)}
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollBox>
      </div>

      {heads ? (
        <div className={s.list}>
          {groups().map((g) => (
            <div key={g.key} className={s.group}>
              <p className={s.gh} aria-hidden="true">{g.head}</p>
              <ul className={s.rows} aria-label={g.head}>
                {g.items.map(({ r, c, d }, i) => {
                  const kind = c.kind ?? "work";
                  const tone = KIND_TONE[kind];
                  const title = `${g.dated ? `${dateShort(d.day, today)} ` : ""}${c.half ? `${HALF_LABEL[c.half]} · ` : ""}${textOf(r, c)}`;
                  // 줄이 여럿(팀 · 공정)이면 둘째 줄에 줄 이름을 붙여요: '1팀 · 실측 · 빈 집'
                  const sub = [shown.length > 1 && c.label ? r.name : null, c.note].filter(Boolean).join(" · ");
                  const body = (
                    <>
                      <span className={s.rl}>
                        <b>{title}</b>
                        {sub ? <span>{sub}</span> : null}
                      </span>
                      {tone ? <StateTag tone={tone}>{KIND_WORD[kind]}</StateTag> : kind === "dry" || kind === "clean" ? <span className={s.kindWord}>{KIND_WORD[kind]}</span> : null}
                    </>
                  );
                  return (
                    <li key={i}>
                      {c.href ? <Link href={c.href} className={`${s.row} ${s.rowLink}`}>{body}</Link> : <div className={s.row}>{body}</div>}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <ol className={s.list} aria-label={caption}>
          {days.map((d) => {
            const items = shown.flatMap((r) => r.cells.filter((c) => c.day === d.day).map((c) => ({ r, c })))
              .sort((a, b) => (a.c.half === "pm" ? 1 : 0) - (b.c.half === "pm" ? 1 : 0));
            if (!items.length && !d.off) return null;
            const p = md(d.day);
            return (
              <li key={d.day} className={[s.item, d.off && !items.length ? s.restDay : null].filter(Boolean).join(" ")}>
                <p className={s.dt}>
                  <time dateTime={d.day} aria-label={dayName(d)}>{p.md}<span>{p.w}</span></time>
                  {d.day === today ? <span className={s.todayTag} aria-hidden="true">오늘</span> : null}
                </p>
                <div className={s.bars}>
                  {items.length ? items.map(({ r, c }, i) => {
                    const kind = c.kind ?? "work";
                    const text = `${c.half ? `${HALF_LABEL[c.half]} ` : ""}${textOf(r, c)}${kind !== "work" && kind !== "dry" && kind !== "clean" ? ` · ${KIND_WORD[kind]}` : ""}`;
                    const cls = [s.lbar, s[kind]].join(" ");
                    return c.href
                      ? <Link key={i} href={c.href} className={cls}>{text}</Link>
                      : <span key={i} className={cls}>{text}</span>;
                  }) : <span className={s.rest}>{d.holiday ? `${d.holiday} · 쉬는 날` : "쉬는 날"}</span>}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {legend?.length ? (
        <ul className={s.legend} aria-label="칸 뜻">
          {legend.map((k) => (
            <li key={k}><i className={[s.sw, k === "off" ? s.swOff : s[k]].join(" ")} aria-hidden="true" />{k === "off" ? "쉬는 날(토 · 일 · 공휴일)" : KIND_WORD[k]}</li>
          ))}
        </ul>
      ) : null}
      {note ? <p className={s.foot}>{note}</p> : null}
    </div>
  );
}
