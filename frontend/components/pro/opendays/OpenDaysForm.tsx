"use client";
// 실측 영업일 등록(2026-11-25 회의): 업체가 실측 받는 요일과 쉬는 날을 미리 정해 두면, 고객은 이 안의 빈 반나절만 골라 요청해요.
// GET · PUT /vendor/open-days. 반나절마다 받는 수(칸)는 업체 정보의 기존 값을 그대로 써요.
import { useState } from "react";
import { BottomBar } from "@/components/ui/BottomBar";
import { Button } from "@/components/ui/Button";
import { Calendar } from "@/components/ui/Calendar";
import { ChoiceChips } from "@/components/ui/ChoiceChip";
import { useToast } from "@/components/ui/Toast";
import { call, errorText, type Schemas } from "@/lib/backend/client";
import { dateShort } from "@/lib/format";
import s from "./OpenDaysForm.module.css";

type Days = Schemas["OpenDaysOut"];
const WEEK = ["월", "화", "수", "목", "금", "토", "일"];

export function OpenDaysForm({ initial, today }: { initial: Days; today: string }) {
  const toast = useToast();
  const [week, setWeek] = useState<string[]>(initial.open_weekdays.map(String));
  const [off, setOff] = useState<string[]>(initial.off_days);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!week.length) { setErr("실측 받는 요일을 하루 이상 골라 주세요."); return; }
    setBusy(true);
    setErr(null);
    try {
      const out = await call<Days>("PUT", "/vendor/open-days", { open_weekdays: week.map(Number), off_days: off });
      setWeek(out.open_weekdays.map(String));
      setOff(out.off_days);
      toast.show("영업일을 저장했어요");
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className={s.group} aria-labelledby="od-week">
        <h2 id="od-week" className={s.h}>실측 받는 요일</h2>
        <p className={s.help}>고객은 이 요일의 빈 반나절만 골라요. 현장 정보(주차 · 엘리베이터)를 보고 수락 · 다른 날 제안 · 못 받아요를 정할 수 있어요.</p>
        <ChoiceChips multiple legend="실측 받는 요일" hideLegend value={week} onChange={(v) => { setWeek(v); setErr(null); }}
          options={WEEK.map((w, i) => ({ value: String(i), label: w }))} />
      </section>
      <section className={s.group} aria-labelledby="od-off">
        <h2 id="od-off" className={s.h}>쉬는 날</h2>
        <p className={s.help}>달력에서 누르면 쉬는 날로 빠져요. 다시 누르면 풀려요.</p>
        <Calendar mode="multiple" label="쉬는 날 고르기" today={today} month={today} value={off} onChange={setOff} />
        <p className={s.help}>{off.length ? `쉬는 날 ${off.length}일 · ${off.slice(0, 6).map((d) => dateShort(d)).join(", ")}${off.length > 6 ? " …" : ""}` : "쉬는 날이 없어요"}</p>
      </section>
      {err ? <p className="mj-error" role="alert">{err}</p> : null}
      <BottomBar>
        <Button size="lg" onClick={save} busy={busy}>{busy ? "저장하는 중" : "영업일 저장"}</Button>
      </BottomBar>
    </>
  );
}
