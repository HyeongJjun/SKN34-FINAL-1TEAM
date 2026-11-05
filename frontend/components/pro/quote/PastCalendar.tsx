"use client";
// 지난 날만 고르는 펼친 달력 (실측한 날). components/start/DateCalendar는 오늘부터만 고르게 되어 있어서,
// 같은 모양(mj-cal) · 같은 설정으로 고를 수 있는 날만 반대로 둔다. 오늘 날짜는 밖에서 받는다.
import { DayPicker } from "@daypicker/react";
import { ko } from "@daypicker/react/locale";
import "@daypicker/react/style.css";

const toDate = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const toStr = (d?: Date) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : "");

type Props = { today: string; label: string; id?: string; value: string; onChange: (v: string) => void };

export function PastCalendar({ today, label, id, value, onChange }: Props) {
  const t = toDate(today);
  const sel = value ? toDate(value) : undefined;
  return (
    <div className="mj-cal" role="group" aria-label={label} id={id}>
      <DayPicker
        locale={ko}
        today={t}
        startMonth={new Date(t.getFullYear() - 1, t.getMonth())}
        endMonth={t}
        disabled={{ after: t }}
        weekStartsOn={0}
        modifiers={{ sun: { dayOfWeek: [0] } }}
        modifiersClassNames={{ sun: "mj-cal-sun" }}
        formatters={{ formatCaption: (m: Date) => `${m.getFullYear()}년 ${m.getMonth() + 1}월` }}
        mode="single"
        selected={sel}
        defaultMonth={sel ?? t}
        onSelect={(d) => onChange(toStr(d))}
      />
    </div>
  );
}
