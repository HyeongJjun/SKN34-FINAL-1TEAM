"use client";
// 반나절 칸(design-system 3.2 HalfDayPicker · 9판 k-half): 고른 날의 오전 · 오후. 시각은 확정 뒤 채팅으로 정해요.
// 칸 상태: open 고를 수 있음 · proposed 업체가 제안한 칸(주황) · closed 마감(다른 고객이 먼저 고름, 꺼짐). 고르면 파랑 바탕.
// 진짜 radio를 숨겨 써서 화살표 키 · 화면 읽기가 그대로 돼요. 칸 50px.
import { useId } from "react";
import { HALF_LABEL, type Half } from "@/lib/format";
import s from "./HalfDayPicker.module.css";

export type HalfState = "open" | "proposed" | "closed";

export function HalfDayPicker({ legend, value, onChange, slots }: {
  /** 고른 날 '12월 15일(화)' */
  legend: string;
  value: Half | null;
  onChange: (v: Half) => void;
  slots: Partial<Record<Half, HalfState>>;
}) {
  const name = useId();
  return (
    <fieldset className={s.set}>
      <legend className={s.legend}>{legend}</legend>
      <div className={s.halves}>
        {(["am", "pm"] as Half[]).map((h) => {
          const st = slots[h];
          if (!st) return null;
          const closed = st === "closed";
          const on = value === h;
          return (
            <label key={h} className={[s.half, on ? s.on : null, st === "proposed" ? s.prop : null, closed ? s.closed : null].filter(Boolean).join(" ")}>
              <input type="radio" name={name} value={h} checked={on} disabled={closed} onChange={() => onChange(h)} className={s.input} />
              <span>{HALF_LABEL[h]}{closed ? " · 마감" : ""}</span>
              {st === "proposed" ? <span className="mj-sr">, 업체 제안</span> : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
