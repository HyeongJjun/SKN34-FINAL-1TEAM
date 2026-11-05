"use client";
// 꼭 고르는 날짜 칸 (components/pro/quote/DateField와 같은 모양): 누르면 바로 아래에 달력을 펼치고, 고르면 접는다.
// past = 통화한 날(오늘까지, PastCalendar), 그 밖 = 공사 날짜(내일부터, 쉬는 날 막음, JobCalendar).
import { useRef, useState } from "react";
import { FieldError } from "@/components/auth/parts";
import { PastCalendar } from "@/components/pro/quote/PastCalendar";
import { md } from "@/lib/format";
import { JobCalendar } from "./JobCalendar";
import s from "./jobs.module.css";

type Props = {
  id: string;
  label: string;
  value: string;
  today: string;
  past?: boolean;
  holidays?: Set<string>;
  weekendOff?: boolean;
  from?: string;
  month?: string;
  hint?: string;
  /** 칸 밖의 안내 · 오류 id (두 칸이 같이 쓰는 문장) */
  describedBy?: string;
  error?: string;
  disabled?: boolean;
  onChange: (v: string) => void;
};

const Cal = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="2" y="3" width="12" height="11" rx="1.5" /><path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" /></svg>
);

const NONE = new Set<string>();

export function JobDateField({ id, label, value, today, past, holidays = NONE, weekendOff = false, from, month, hint, describedBy, error, disabled, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const desc = [hint ? `${id}-h` : "", describedBy ?? "", error ? `${id}-e` : ""].filter(Boolean).join(" ") || undefined;

  function pick(v: string) {
    onChange(v);
    setOpen(false);
    setTimeout(() => btn.current?.focus(), 0);
  }

  return (
    <div className={`mj-field ${s.dateField}`} onKeyDown={(e) => { if (e.key === "Escape" && open) { e.preventDefault(); setOpen(false); btn.current?.focus(); } }}>
      <span id={`${id}-l`} className="mj-label">{label} <span className="mj-opt">(필수)</span></span>
      <button ref={btn} id={id} type="button" className={`mj-btn mj-btn-sec ${s.dateBtn}`} aria-expanded={open} aria-controls={`${id}-cal`}
        aria-labelledby={`${id}-l ${id}`} aria-describedby={desc} aria-invalid={error ? true : undefined} disabled={disabled} onClick={() => setOpen((o) => !o)}>
        <Cal /><span className="mj-num">{value ? md(value) : "날짜 고르기"}</span>
      </button>
      {hint ? <p id={`${id}-h`} className="mj-hint mj-num">{hint}</p> : null}
      {error ? <FieldError id={`${id}-e`}>{error}</FieldError> : null}
      {open ? (
        <div id={`${id}-cal`} className={s.calBox}>
          {past
            ? <PastCalendar today={today} label={`${label} 고르기`} value={value} onChange={pick} />
            : <JobCalendar today={today} label={`${label} 고르기`} value={value} holidays={holidays} weekendOff={weekendOff} from={from} month={month} onChange={pick} />}
        </div>
      ) : null}
    </div>
  );
}
