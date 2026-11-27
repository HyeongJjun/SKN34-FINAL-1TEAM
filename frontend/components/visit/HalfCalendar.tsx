"use client";
// 실측 반나절 달력(2026-11-26 팀 피드백 3: '날짜 더 보기'로 줄이 길어지지 않게 달력에서 날을 누르고 오전 · 오후를 골라요).
// 서버가 준 날(days)만 누를 수 있어요. 달력 칸 자리(요일)만 화면에서 맞추고, 고를 수 있는 날은 계산하지 않아요.
import { useState } from "react";
import { HALF_LABEL, dayParts } from "@/lib/format";
import s from "./HalfCalendar.module.css";

type Half = "am" | "pm";
export type CalDay = { day: string; halves: Half[] };
export type CalPick = { day: string; half: Half };

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

/** YYYY-MM-DD에서 n일 뒤(달력 칸 채우기만) */
function shift(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const weekday = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();

export function HalfCalendar({ days, value, onChange, label }: { days: CalDay[]; value: CalPick | null; onChange: (v: CalPick | null) => void; label: string }) {
  const open = new Map(days.filter((x) => x.halves.length).map((x) => [x.day, x.halves]));
  const sorted = [...open.keys()].sort();
  const [day, setDay] = useState<string | null>(value?.day ?? null);
  if (!sorted.length) return null;
  // 첫 날이 있는 주 일요일 ~ 마지막 날이 있는 주 토요일
  const first = shift(sorted[0], -weekday(sorted[0]));
  const last = shift(sorted[sorted.length - 1], 6 - weekday(sorted[sorted.length - 1]));
  const cells: string[] = [];
  for (let d = first; d <= last; d = shift(d, 1)) cells.push(d);
  const halves = day ? open.get(day) ?? [] : [];
  const p = day ? dayParts(day) : null;
  return (
    <div className={s.wrap}>
      <div className={s.grid} role="grid" aria-label={label}>
        {WEEK.map((w, i) => <span key={w} className={`${s.head} ${i === 0 ? s.sun : ""}`} role="columnheader">{w}</span>)}
        {cells.map((d) => {
          const x = dayParts(d);
          const ok = open.has(d);
          const on = day === d;
          const picked = value?.day === d;
          // 그 달 1일과 첫 칸에는 월을 같이 적어요
          const text = x.d === 1 || d === sorted[0] ? `${x.m}.${x.d}` : String(x.d);
          return ok ? (
            <button key={d} type="button" role="gridcell" aria-selected={on} aria-label={`${x.m}월 ${x.d}일 ${x.w}요일${picked ? ` ${HALF_LABEL[value!.half]} 고름` : ""}`}
              className={[s.cell, s.open, on ? s.on : "", picked ? s.picked : ""].join(" ")} onClick={() => setDay(on ? null : d)}>
              <span className="mj-num">{text}</span>
              {picked ? <small>{HALF_LABEL[value!.half]}</small> : <i className={s.dot} aria-hidden="true" />}
            </button>
          ) : <span key={d} role="gridcell" aria-disabled="true" className={s.cell}><span className="mj-num">{text}</span></span>;
        })}
      </div>
      {day && p ? (
        <div className={s.halves} role="group" aria-label={`${p.m}.${p.d} ${p.w} 반나절`}>
          <b className="mj-num">{p.m}.{p.d} {p.w}</b>
          {(["am", "pm"] as Half[]).map((h) => {
            const ok = halves.includes(h);
            const on = value?.day === day && value.half === h;
            return (
              <button key={h} type="button" className={on ? `${s.half} ${s.halfOn}` : s.half} disabled={!ok} aria-pressed={on}
                onClick={() => onChange(on ? null : { day, half: h })}>
                {HALF_LABEL[h]}{ok ? "" : " 마감"}
              </button>
            );
          })}
        </div>
      ) : <p className={s.note}>점 있는 날을 누르면 오전 · 오후를 골라요.</p>}
    </div>
  );
}
