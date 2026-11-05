"use client";
// 공사 날짜를 고르는 펼친 달력. components/start/DateCalendar와 같은 모양(mj-cal) · 같은 설정에
// 고를 수 없는 날만 더한다: 오늘까지, 공휴일(JobOut.holidays), 주말 공사가 아니면 토 · 일, 끝나는 날은 시작일 앞.
// 쉬는 날은 API가 준 목록 · 규칙으로 막기만 하고, 일하는 날 · 기간은 세지 않는다(미리 계산은 API).
import { DayPicker, type Matcher } from "@daypicker/react";
import { ko } from "@daypicker/react/locale";
import "@daypicker/react/style.css";

const toDate = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const toStr = (d?: Date) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : "");

type Props = {
  today: string;
  label: string;
  value: string;
  /** 공휴일 "YYYY-MM-DD" */
  holidays: Set<string>;
  /** 토 · 일도 쉬는 날인지 (예상 공정표가 주말 공사가 아니면 true) */
  weekendOff: boolean;
  /** 이 날 앞은 고를 수 없음 (끝나는 날 = 시작일부터) */
  from?: string;
  /** 처음 펼칠 달 (고른 날이 없을 때) */
  month?: string;
  onChange: (v: string) => void;
};

export function JobCalendar({ today, label, value, holidays, weekendOff, from, month, onChange }: Props) {
  const t = toDate(today);
  const sel = value ? toDate(value) : undefined;
  const off: Matcher[] = [{ before: t }, t, (d: Date) => holidays.has(toStr(d))];
  if (weekendOff) off.push({ dayOfWeek: [0, 6] });
  if (from) off.push({ before: toDate(from) });
  return (
    <div className="mj-cal" role="group" aria-label={label}>
      <DayPicker
        locale={ko}
        today={t}
        startMonth={t}
        endMonth={new Date(t.getFullYear() + 1, t.getMonth())}
        disabled={off}
        weekStartsOn={0}
        modifiers={{ sun: { dayOfWeek: [0] } }}
        modifiersClassNames={{ sun: "mj-cal-sun" }}
        formatters={{ formatCaption: (m: Date) => `${m.getFullYear()}년 ${m.getMonth() + 1}월` }}
        mode="single"
        selected={sel}
        defaultMonth={sel ?? (month ? toDate(month) : t)}
        onSelect={(d) => onChange(toStr(d))}
      />
    </div>
  );
}
