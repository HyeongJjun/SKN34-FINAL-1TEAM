"use client";
// 날짜 바꿔 보기 (시안 WPlan): 시작일 · 주말 공사를 바꿔 POST /projects/{id}/plan → 화면을 새 결과로 다시 그린다.
// 날짜 · 기간은 서버(계산 엔진)가 정한다. 오늘은 못 고른다(서버가 내일부터 받는다).
// 업체를 확정한 뒤에는 서버가 막아서(409 dates_locked) 칸 대신 공사 날짜 화면 버튼만 둔다(locked).
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FieldError } from "@/components/auth/parts";
import { DateCalendar } from "@/components/start/DateCalendar";
import { call, errorText, type Schemas } from "@/lib/backend/client";
import { md } from "@/lib/format";
import s from "./PlanRedo.module.css";

export function PlanRedo({ id, start, weekend, today, locked = false }: { id: string; start: string; weekend: boolean; today: string; locked?: boolean }) {
  if (locked) {
    return <p className={s.box}><Link className="mj-btn mj-btn-sec" href={`/projects/${id}/schedule`}>공사 날짜 보기</Link></p>;
  }
  return <RedoForm id={id} start={start} weekend={weekend} today={today} />;
}

function RedoForm({ id, start, weekend, today }: { id: string; start: string; weekend: boolean; today: string }) {
  const router = useRouter();
  const [day, setDay] = useState(start);
  const [wk, setWk] = useState(weekend);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  async function go(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!day) { setError("시작일을 골라 주세요."); return; }
    setBusy(true);
    setError("");
    setMsg("");
    try {
      const p = await call<Schemas["PlanOut"]>("POST", `/projects/${id}/plan`, { start: day, weekend_work: wk });
      const workEnd = p.blocks.filter((b) => b.kind === "work").at(-1)?.end ?? p.end;
      setMsg(`다시 계산했어요. 일하는 날 ${p.work_days}일 · ${md(p.start)} ~ ${md(workEnd)}`);
      router.refresh();
    } catch (er) {
      setError(errorText(er));
    }
    setBusy(false);
  }

  return (
    <form className={s.box} onSubmit={go} noValidate aria-labelledby="pl-chg-t">
      <h2 id="pl-chg-t" className="mj-h3">날짜 바꿔 보기</h2>
      <div className={s.field}>
        <p className={s.lab} aria-hidden="true">시작일</p>
        <DateCalendar id="pl-cal" value={day} onChange={(v) => { setDay(v); setError(""); setMsg(""); }} today={today} notToday label="시작일" describedBy={error ? "pl-err" : undefined} />
        {day ? <p className="mj-small" aria-live="polite">고른 날: <b className="mj-num">{md(day)}</b></p> : null}
        {error ? <FieldError id="pl-err">{error}</FieldError> : null}
      </div>
      <label className={s.ckrow}><input className={s.ck} type="checkbox" checked={wk} onChange={(e) => { setWk(e.target.checked); setMsg(""); }} />주말에도 공사해요</label>
      <p><button type="submit" className="mj-btn mj-btn-sec" disabled={busy}>{busy ? "다시 계산하고 있어요…" : "다시 계산하기"}</button></p>
      <p className="mj-small mj-num" role="status">{msg}</p>
    </form>
  );
}
