"use client";
// 업체가 올린 공사 날(C35): 날을 하나씩 고른 달력을 보여 주기만 해요(고객은 여기서 날을 바꾸지 않아요 → '다른 날짜 요청').
// 공휴일은 빨강 글자 + 칸 아래 이름(두 글자, 예: 신정). 오늘은 서버가 준 날이에요.
import { Calendar, type DayMark, type DayNote } from "@/components/ui/Calendar";

export function WorkDays({ days, holidays, today, label = "공사 날짜 달력" }: { days: string[]; holidays: { day: string; name: string }[]; today: string; label?: string }) {
  const marks: Record<string, DayMark[]> = {};
  const notes: Record<string, DayNote> = {};
  for (const h of holidays) {
    marks[h.day] = ["holiday"];
    notes[h.day] = { text: h.name.slice(0, 2), label: h.name };
  }
  return (
    <Calendar
      mode="multiple"
      label={label}
      today={today}
      month={days[0] ?? today}
      value={days}
      onChange={() => {}}
      only={days}
      min={days[0] && days[0] < today ? days[0] : today}
      marks={marks}
      notes={notes}
    />
  );
}
