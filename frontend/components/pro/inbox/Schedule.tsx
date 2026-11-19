// 작업함 · 일정 탭(V08 v_sched · 웹 팀 줄 표): GET /vendor/schedule의 반나절을 B4 ScheduleChart로 그려요(half · labelHead="팀").
// 칸 = items의 day · half · kind(booked 확정 | hold 잡아 둠) · area_label, 누르면 그 요청으로 가요. 값은 API 그대로예요.
// 날은 API가 준 칸이 있는 날만 넘겨요(화면이 날짜를 만들지 않아요). 팀 줄은 반나절당 받는 수(capacity)만큼이에요(L03).
// 잡아 둔 반나절은 수락 기한을 칸 글에 붙여요(폰 목록에서도 보이게).
import { EmptyState } from "@/components/ui/EmptyState";
import { Notice } from "@/components/ui/Notice";
import { ScheduleChart, type ChartRow } from "@/components/ui/ScheduleChart";
import type { VendorSchedule } from "@/lib/api/vendor";
import { dateSeoul, dueText, rangeText } from "@/lib/format";
import s from "./inbox.module.css";

export function Schedule({ data, now }: { data: VendorSchedule | null; now: string }) {
  const items = data?.items ?? [];
  if (!data || !items.length) return <EmptyState icon="calendar" title="잡힌 실측이 없어요">고객이 날짜를 고르면 여기에 보여요.</EmptyState>;
  const days = [...new Set(items.map((x) => x.day))].sort().map((day) => ({ day }));
  const seatCount = Math.max(data.capacity, ...items.map((x) => x.seat));
  const rows: ChartRow[] = Array.from({ length: seatCount }, (_, i) => i + 1).map((n) => ({
    key: `s${n}`,
    name: `${n}팀`,
    cells: items
      .filter((x) => x.seat === n)
      .map((x) => ({
        day: x.day,
        half: x.half,
        kind: x.kind,
        label: x.kind === "hold" && x.hold_until ? `${x.area_label} · ${dueText(x.hold_until, { now, relative: true })} 수락` : x.area_label,
        href: `/vendor/requests/${encodeURIComponent(x.visit_id)}`,
      })),
  }));
  return (
    <div className={s.sched}>
      <ScheduleChart caption={`${rangeText(data.start, data.end)} 실측 일정`} half labelHead="팀" days={days} rows={rows} today={dateSeoul(now)} legend={["booked", "hold"]} />
      <Notice tone="gray">바로 확정으로 잡힌 반나절과 수락을 기다리며 잡아 둔 반나절은 열어 둔 다른 요청 기간에서 빠져요.</Notice>
    </div>
  );
}
