"use client";
// 업체 영업일에서 실측 반나절 고르기(2026-11-25 회의): 업체가 미리 등록한 영업 요일 · 쉬는 날 안의 빈 반나절만 보여요.
// 읽기: GET /projects/{id}/vendors/{vid}/open-days(서버가 칸 수 · 같은 집 다른 실측까지 빼요). 화면은 날짜를 계산하지 않고 받은 날만 그려요.
import { useEffect, useState } from "react";
import { call, errorText, type Schemas } from "@/lib/backend/client";
import { HALF_LABEL, dayParts } from "@/lib/format";
import s from "./OpenDayPicker.module.css";

type Half = "am" | "pm";
export type DayPick = { day: string; half: Half };
type Days = Schemas["VisitOpenDaysOut"];

/** 오늘(서울 날짜)에서 n일 뒤 YYYY-MM-DD (날짜 칸 읽기 범위만 정해요) */
function plusDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function OpenDayPicker({ projectId, vendorId, name, today, value, onChange }: {
  projectId: string; vendorId: string; name: string; today: string; value: DayPick | null; onChange: (v: DayPick | null) => void;
}) {
  const [days, setDays] = useState<Days["days"] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [more, setMore] = useState(false);

  useEffect(() => {
    let live = true;
    const q = new URLSearchParams({ start: plusDays(today, 1), end: plusDays(today, 42) });
    call<Days>("GET", `/projects/${encodeURIComponent(projectId)}/vendors/${encodeURIComponent(vendorId)}/open-days?${q}`)
      .then((x) => { if (live) setDays(x.days); })
      .catch((e) => { if (live) setErr(errorText(e)); });
    return () => { live = false; };
  }, [projectId, vendorId, today]);

  if (err) return <p className={s.note} role="alert">{err}</p>;
  if (!days) return <p className={s.note}>{name} 영업일을 불러오는 중이에요</p>;
  if (!days.length) return <p className={s.note}>앞으로 6주 안에 {name}이 받을 수 있는 날이 없어요. 채팅으로 물어보거나 다른 업체를 골라 주세요.</p>;
  const shown = more ? days : days.slice(0, 10);
  return (
    <div className={s.wrap}>
      <ul className={s.days} aria-label={`${name} 실측 가능한 날`}>
        {shown.map((x) => {
          const p = dayParts(x.day);
          return (
            <li key={x.day} className={s.day}>
              <span className={s.date}><b className="mj-num">{p.m}.{p.d}</b> {p.w}</span>
              <span className={s.halves}>
                {(["am", "pm"] as Half[]).map((h) => {
                  const ok = x.halves.includes(h);
                  const on = value?.day === x.day && value.half === h;
                  return (
                    <button key={h} type="button" className={on ? `${s.half} ${s.on}` : s.half} disabled={!ok} aria-pressed={on}
                      onClick={() => onChange(on ? null : { day: x.day, half: h })}>
                      {HALF_LABEL[h]}{ok ? "" : " 마감"}
                    </button>
                  );
                })}
              </span>
            </li>
          );
        })}
      </ul>
      {days.length > 10 ? <button type="button" className={s.more} onClick={() => setMore((v) => !v)}>{more ? "접기" : `날짜 더 보기 (${days.length - 10}일)`}</button> : null}
    </div>
  );
}
