"use client";
// 업체 기간 답하기 달력(V04 · D14). 9판: '시작 · 끝을 누르고, 안 되는 날은 한 번 더 눌러요.'
// B4 Calendar(range)는 기간 안 날을 다시 눌러 '빼는 날'로 바꾸는 동작이 없어서, 같은 DayPicker 위에 이 화면만의 규칙을 얹었어요.
// 날 상태: 고객 희망(띠) · 고른 기간(띠 + 시작 · 끝 동그라미) · 빼는 날(가로줄) · 잡힌 반나절(회색 + '오전 · 오후'). 날마다 읽는 이름을 붙여요.
// 날짜 값은 "YYYY-MM-DD", 오늘은 서버가 준 값이에요(시계를 읽지 않아요). B4 Calendar가 이 동작을 갖게 되면 바꿔요(verification/b3.md 부탁).
import { createContext, useContext, useMemo } from "react";
import { DayPicker, type DayButtonProps, type Matcher } from "@daypicker/react";
import { ko } from "@daypicker/react/locale";
import { dateSpoken } from "@/lib/format";
import { Icon } from "@/components/ui/Icon";
import s from "./PeriodCalendar.module.css";

export type Period = { start: string | null; end: string | null; excluded: string[] };
export type TakenHalf = { day: string; half: "am" | "pm"; kind: "hold" | "booked" };

const toDate = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d); };
const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** 누른 날로 다음 기간을 정해요: 처음 → 시작, 그다음 → 끝(시작보다 앞이면 새 시작), 기간 안 날 → 빼는 날 넣고 빼기, 밖 · 시작 · 끝 → 새 시작 */
export function nextPeriod(p: Period, day: string): Period {
  if (!p.start || (p.start && p.end && (day <= p.start || day >= p.end))) return { start: day, end: null, excluded: [] };
  if (!p.end) return day < p.start ? { start: day, end: null, excluded: [] } : { start: p.start, end: day, excluded: [] };
  return { ...p, excluded: p.excluded.includes(day) ? p.excluded.filter((d) => d !== day) : [...p.excluded, day].sort() };
}

type Note = { short: string; long: string; label: string };
const Notes = createContext<Record<string, Note>>({});

function DayButton({ day, modifiers, children, ...rest }: DayButtonProps) {
  const notes = useContext(Notes);
  const n = notes[toIso(day.date)];
  return (
    <button {...rest} data-focused={modifiers.focused || undefined}>
      <span className={s.dot}>{children}</span>
      {n ? <em className={s.note} aria-hidden="true"><span className={s.short}>{n.short}</span><span className={s.long}>{n.long}</span></em> : null}
    </button>
  );
}

export function PeriodCalendar({ value, onChange, today, wish, taken, month, wide, label }: {
  value: Period;
  onChange: (p: Period) => void;
  today: string;
  wish?: { from: string; to: string } | null;
  taken: TakenHalf[];
  month?: string | null;
  /** 웹 큰 달력(D14) */
  wide?: boolean;
  label: string;
}) {
  const t = toDate(today);
  const notes = useMemo(() => {
    const out: Record<string, Note> = {};
    const byDay = new Map<string, Set<"am" | "pm">>();
    taken.forEach((x) => { const set = byDay.get(x.day) ?? new Set(); set.add(x.half); byDay.set(x.day, set); });
    byDay.forEach((set, d) => {
      const both = set.size === 2;
      const h = both ? "하루" : set.has("am") ? "오전" : "오후";
      out[d] = { short: h, long: `${h} 잡힘`, label: `${both ? "오전 · 오후" : h} 잡힘` };
    });
    value.excluded.forEach((d) => { out[d] = { short: "", long: "빼는 날", label: out[d] ? `${out[d].label}, 빼는 날` : "빼는 날" }; });
    return out;
  }, [taken, value.excluded]);

  const start = value.start ? toDate(value.start) : null;
  const end = value.end ? toDate(value.end) : null;
  const modifiers: Record<string, Matcher | Matcher[]> = {
    sun: { dayOfWeek: [0] },
    wish: wish ? { from: toDate(wish.from), to: toDate(wish.to) } : [],
    wishS: wish ? toDate(wish.from) : [],
    wishE: wish ? toDate(wish.to) : [],
    range: start && end ? { from: start, to: end } : start ? start : [],
    rangeS: start ?? [],
    rangeE: end ?? start ?? [],
    excluded: value.excluded.map(toDate),
    taken: taken.map((x) => toDate(x.day)),
  };
  const modifiersClassNames = { sun: s.sun, wish: s.wish, wishS: s.wishS, wishE: s.wishE, range: s.range, rangeS: s.rangeS, rangeE: s.rangeE, excluded: s.excluded, taken: s.taken };
  const labelDay = (date: Date, m: Record<string, boolean>) => {
    const iso = toIso(date);
    const parts = [dateSpoken(iso)];
    if (m.rangeS && m.rangeE) parts.push("고른 날");
    else if (m.rangeS) parts.push("고른 기간 시작");
    else if (m.rangeE) parts.push("고른 기간 끝");
    else if (m.range) parts.push("고른 기간");
    if (m.wish) parts.push("고객 희망 기간");
    if (notes[iso]) parts.push(notes[iso].label);
    if (m.today) parts.push("오늘");
    return parts.join(", ");
  };

  return (
    <Notes.Provider value={notes}>
      <div className={`${s.cal} ${wide ? s.wide : ""}`} role="group" aria-label={label}>
        <DayPicker
          locale={ko}
          weekStartsOn={0}
          today={t}
          defaultMonth={month ? toDate(month) : t}
          disabled={[{ before: t }]}
          showOutsideDays={false}
          modifiers={modifiers}
          modifiersClassNames={modifiersClassNames}
          onDayClick={(d, m) => { if (!m.disabled) onChange(nextPeriod(value, toIso(d))); }}
          formatters={{ formatCaption: (d: Date) => `${d.getFullYear()}년 ${d.getMonth() + 1}월` }}
          labels={{ labelDayButton: labelDay, labelNext: () => "다음 달", labelPrevious: () => "이전 달" }}
          components={{
            DayButton,
            Chevron: ({ orientation }: { orientation?: "up" | "down" | "left" | "right" }) => <Icon name={orientation === "left" ? "chevron-left" : "chevron-right"} size={20} />,
          }}
          classNames={{
            root: s.root, months: s.months, month: s.month, month_caption: s.caption, caption_label: s.captionLabel,
            nav: s.nav, button_previous: s.navBtn, button_next: s.navBtn, month_grid: s.grid, weekday: s.weekday,
            day: s.day, day_button: s.dayBtn, today: s.today, outside: s.outside, disabled: s.disabled, hidden: s.hidden, focused: s.focused,
          }}
        />
      </div>
    </Notes.Provider>
  );
}

/** 달력 위 범례(9판 k-leg): 고객 희망 · 고른 기간 · 잡힌 반나절 · 빼는 날 */
export function PeriodLegend() {
  return (
    <ul className={s.legend} aria-label="달력 표시">
      <li><i className={s.lgWish} aria-hidden="true" />고객 희망</li>
      <li><i className={s.lgRange} aria-hidden="true" />고른 기간</li>
      <li><i className={s.lgTaken} aria-hidden="true" />잡힌 반나절</li>
      <li><i className={s.lgEx} aria-hidden="true" />빼는 날</li>
    </ul>
  );
}
