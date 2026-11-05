"use client";
// 고르는 날짜 칸(선택): 누르면 바로 아래에 달력을 펼치고, 고르면 접는다. 고른 날은 '지우기'로 비운다.
// past = 실측한 날(오늘까지), 그 밖 = 견적 유효기간(오늘부터).
import { useRef, useState } from "react";
import { FieldError } from "@/components/auth/parts";
import { DateCalendar } from "@/components/start/DateCalendar";
import { md } from "@/lib/format";
import { PastCalendar } from "./PastCalendar";
import s from "./quote.module.css";

type Props = {
  id: string;
  label: string;
  value: string;
  today: string;
  past?: boolean;
  /** 고른 날 뒤에 붙는 말 (유효기간 "까지") */
  tail?: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  onChange: (v: string) => void;
};

const Cal = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="2" y="3" width="12" height="11" rx="1.5" /><path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" /></svg>
);

export function DateField({ id, label, value, today, past, tail = "", hint, error, disabled, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const desc = [hint ? `${id}-h` : "", error ? `${id}-e` : ""].filter(Boolean).join(" ") || undefined;

  function pick(v: string) {
    onChange(v);
    setOpen(false);
    setTimeout(() => btn.current?.focus(), 0);
  }

  return (
    <div className={`mj-field ${s.dateField}`} onKeyDown={(e) => { if (e.key === "Escape" && open) { e.preventDefault(); setOpen(false); btn.current?.focus(); } }}>
      <span id={`${id}-l`} className="mj-label">{label} <span className="mj-opt">(선택)</span></span>
      <div className={s.dateRow}>
        <button ref={btn} id={id} type="button" className={`mj-btn mj-btn-sec ${s.dateBtn}`} aria-expanded={open} aria-controls={`${id}-cal`}
          aria-labelledby={`${id}-l ${id}`} aria-describedby={desc} aria-invalid={error ? true : undefined} disabled={disabled} onClick={() => setOpen((o) => !o)}>
          <Cal /><span className="mj-num">{value ? `${md(value)}${tail}` : "날짜 고르기"}</span>
        </button>
        {value && !disabled ? (
          <button type="button" className={`mj-lnk ${s.clear}`} onClick={() => pick("")}>지우기<span className="mj-sr">, {label}</span></button>
        ) : null}
      </div>
      {hint ? <p id={`${id}-h`} className="mj-hint">{hint}</p> : null}
      {error ? <FieldError id={`${id}-e`}>{error}</FieldError> : null}
      {open ? (
        <div id={`${id}-cal`} className={s.calBox}>
          {past
            ? <PastCalendar today={today} label={`${label} 고르기`} value={value} onChange={pick} />
            : <DateCalendar today={today} label={`${label} 고르기`} value={value} onChange={pick} />}
        </div>
      ) : null}
    </div>
  );
}
