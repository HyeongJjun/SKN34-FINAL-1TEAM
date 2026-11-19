"use client";
// 달력(design-system 3.2 Calendar · routes.md 3장): 날 하나(single) · 날 하나씩 여럿(multiple, 공사 날짜 C35 · V11) · 기간(range, 업체 기간 V04 · D14).
// 표 달력 접근성(화살표 키 · 달 넘기기 · 초점)은 지금 코드의 DayPicker(@daypicker/react)가 맡고, 날 상태는 modifiers로 그려요.
// 날 상태: 업체 가능(파랑 테두리) · 안 됨(옅게 + 가로줄, 꺼짐) · 고른 날(파랑 바탕) · 제안(주황 테두리, 고르면 주황 바탕) · 잡힘(회색 바탕)
//          · 일요일 · 공휴일(빨강 글자) · 희망 띠(blue-50) · 업체 띠(blue-100) · 오늘(밑줄).
// 칸 아래 글(notes)은 폰에서 두 글자까지(오전 · 오후 · 마감 · 신정 · 희망). 자세한 말은 notes.label로 날마다 읽어 줘요
// ('12월 15일 화요일, 업체 가능, 오전만'). 날짜 값은 "YYYY-MM-DD", 오늘은 서버가 준 값을 넘겨요(시계를 읽지 않아요).
import { createContext, useContext, useMemo } from "react";
import { DayPicker, type DayButtonProps, type Matcher } from "@daypicker/react";
import { ko } from "@daypicker/react/locale";
import { dateSpoken } from "@/lib/format";
import { Icon } from "./Icon";
import s from "./Calendar.module.css";

export type DayMark = "available" | "unavailable" | "proposed" | "booked" | "holiday";
export type DayNote = { text: string; label?: string };
type Span = { from: string; to: string };

type Common = {
  /** 달력 묶음 이름(화면 읽기) */
  label: string;
  /** 오늘(서울 날짜) */
  today: string;
  /** 처음 보일 달(그 달의 아무 날) */
  month?: string;
  marks?: Record<string, DayMark[]>;
  /** 내 희망 기간 띠 */
  wish?: Span;
  /** 업체 가능 기간 띠 */
  vendor?: Span;
  notes?: Record<string, DayNote>;
  /** 이 날들만 고를 수 있어요(나머지는 꺼짐) */
  only?: string[];
  /** 이날 전은 꺼짐(기본: 오늘 전) */
  min?: string;
  max?: string;
  /** 넓은 달력(웹 D14 · D15): 칸 64 · 동그라미 42 */
  wide?: boolean;
};
type Single = Common & { mode: "single"; value: string | null; onChange: (v: string | null) => void };
type Multi = Common & { mode: "multiple"; value: string[]; onChange: (v: string[]) => void; max?: string };
type Range = Common & { mode: "range"; value: { from: string; to?: string } | null; onChange: (v: { from: string; to?: string } | null) => void };
export type CalendarProps = Single | Multi | Range;

const toDate = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d); };
const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysOf = (marks: Record<string, DayMark[]> | undefined, k: DayMark) => Object.entries(marks ?? {}).filter(([, v]) => v.includes(k)).map(([d]) => toDate(d));

const MARK_WORD: Record<DayMark, string> = { available: "업체 가능", unavailable: "안 됨", proposed: "제안", booked: "잡힘", holiday: "공휴일" };
const NotesCtx = createContext<Record<string, DayNote>>({});

function DayButton({ day, modifiers, children, ...rest }: DayButtonProps) {
  const notes = useContext(NotesCtx);
  const note = notes[toIso(day.date)];
  return (
    <button {...rest} data-focused={modifiers.focused || undefined}>
      <span className={s.dot}>{children}</span>
      {note ? <em className={s.note} aria-hidden="true">{note.text}</em> : null}
    </button>
  );
}

export function Calendar(props: CalendarProps) {
  const { label, today, month, marks, wish, vendor, notes = {}, only, min, max, wide } = props;
  const t = toDate(today);
  const disabled = useMemo(() => {
    const list: Matcher[] = [{ before: min ? toDate(min) : t }, ...daysOf(marks, "unavailable")];
    if (max) list.push({ after: toDate(max) });
    if (only) { const set = new Set(only); list.push((d: Date) => !set.has(toIso(d))); }
    return list;
  }, [min, max, only, marks, t]);

  const modifiers = {
    sun: { dayOfWeek: [0] },
    available: daysOf(marks, "available"),
    unavailable: daysOf(marks, "unavailable"),
    proposed: daysOf(marks, "proposed"),
    booked: daysOf(marks, "booked"),
    holiday: daysOf(marks, "holiday"),
    wish: wish ? { from: toDate(wish.from), to: toDate(wish.to) } : [],
    wishStart: wish ? toDate(wish.from) : [],
    wishEnd: wish ? toDate(wish.to) : [],
    vband: vendor ? { from: toDate(vendor.from), to: toDate(vendor.to) } : [],
    vbandStart: vendor ? toDate(vendor.from) : [],
    vbandEnd: vendor ? toDate(vendor.to) : [],
  };
  const modifiersClassNames = {
    sun: s.sun, available: s.avail, unavailable: s.unavail, proposed: s.prop, booked: s.booked, holiday: s.holiday,
    wish: s.wish, wishStart: s.wishS, wishEnd: s.wishE, vband: s.vband, vbandStart: s.vbandS, vbandEnd: s.vbandE,
  };

  const labelDay = (date: Date, m: Record<string, boolean>) => {
    const iso = toIso(date);
    const parts = [dateSpoken(iso)];
    if (m.selected) parts.push("고른 날");
    (Object.keys(MARK_WORD) as DayMark[]).forEach((k) => { if (marks?.[iso]?.includes(k)) parts.push(MARK_WORD[k]); });
    if (m.wish) parts.push("내 희망 기간");
    if (m.today) parts.push("오늘");
    const n = notes[iso];
    if (n) parts.push(n.label ?? n.text);
    return parts.join(", ");
  };

  const common = {
    locale: ko,
    weekStartsOn: 0 as const,
    today: t,
    defaultMonth: month ? toDate(month) : t,
    disabled,
    modifiers,
    modifiersClassNames,
    showOutsideDays: false,
    formatters: { formatCaption: (d: Date) => `${d.getFullYear()}년 ${d.getMonth() + 1}월` },
    labels: {
      labelDayButton: labelDay,
      labelNext: () => "다음 달",
      labelPrevious: () => "이전 달",
    },
    components: {
      DayButton,
      Chevron: ({ orientation }: { orientation?: "up" | "down" | "left" | "right" }) => <Icon name={orientation === "left" ? "chevron-left" : "chevron-right"} size={20} />,
    },
    classNames: {
      root: s.root, months: s.months, month: s.month, month_caption: s.caption, caption_label: s.captionLabel,
      nav: s.nav, button_previous: s.navBtn, button_next: s.navBtn, month_grid: s.grid, weekdays: s.weekdays, weekday: s.weekday,
      weeks: s.weeks, week: s.week, day: s.day, day_button: s.dayBtn, selected: s.selected, today: s.today, outside: s.outside,
      disabled: s.disabled, hidden: s.hidden, range_start: s.rangeStart, range_middle: s.rangeMid, range_end: s.rangeEnd, focused: s.focused,
    },
  };

  let picker: React.ReactNode;
  if (props.mode === "single") {
    picker = <DayPicker {...common} mode="single" selected={props.value ? toDate(props.value) : undefined} onSelect={(d) => props.onChange(d ? toIso(d) : null)} />;
  } else if (props.mode === "multiple") {
    picker = <DayPicker {...common} mode="multiple" selected={props.value.map(toDate)} onSelect={(ds) => props.onChange((ds ?? []).map(toIso).sort())} />;
  } else {
    const v = props.value;
    picker = (
      <DayPicker
        {...common}
        mode="range"
        selected={v ? { from: toDate(v.from), to: v.to ? toDate(v.to) : undefined } : undefined}
        onSelect={(r) => props.onChange(r?.from ? { from: toIso(r.from), to: r.to ? toIso(r.to) : undefined } : null)}
      />
    );
  }
  const hasNotes = Object.keys(notes).length > 0;
  return (
    <NotesCtx.Provider value={notes}>
      <div className={[s.cal, wide ? s.wide : null, hasNotes ? s.withNotes : null].filter(Boolean).join(" ")} role="group" aria-label={label}>
        {picker}
      </div>
    </NotesCtx.Provider>
  );
}

/** 범례(design-system CalendarLegend): 달력 위 한 줄 */
export type LegendKey = "wish" | "vendor" | "available" | "selected" | "unavailable" | "proposed" | "booked" | "holiday";
const LEGEND: Record<LegendKey, string> = { wish: "내 희망", vendor: "업체 가능 기간", available: "업체 가능", selected: "고른 날", unavailable: "안 됨", proposed: "제안", booked: "잡힘", holiday: "공휴일" };
export function CalendarLegend({ items, wishText }: { items: LegendKey[]; /** '내 희망 12.7~12.21' */ wishText?: string }) {
  return (
    <ul className={s.legend} aria-label="달력 표시">
      {items.map((k) => <li key={k}><i className={s[`lg_${k}`]} aria-hidden="true" />{k === "wish" && wishText ? wishText : LEGEND[k]}</li>)}
    </ul>
  );
}
