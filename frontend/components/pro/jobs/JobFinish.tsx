"use client";
// 공사 끝냈어요 · 남은 일 다 했어요 (시안 WVCalendar '공사 끝냈어요'). 날짜를 수락한 공사에만 보인다.
// 누를 수 있는지(can_finish: 마지막 공사일부터, 공사 중 · 남은 일)는 API 값이다. 확인 창 → POST /vendor/jobs/{id}/done(몸통 없음).
// 끝낸 날 · 연락처 기한은 응답 값만 보인다(화면에서 1년을 세지 않는다). 끝내면 수락 기다리던 날짜 바꾸기 · 열린 요청은 서버가 닫는다.
// 마지막 공사일 전(409 too_early) · 이미 올림 · 끝남(409 invalid_state)이면 서버 문장을 보이고 다시 읽는다.
import { useRef, useState } from "react";
import { FieldError } from "@/components/auth/parts";
import { Check, Dash } from "@/components/pro/inbox/Cells";
import { DoneNote } from "@/components/pro/inbox/DoneNote";
import { iGa, untilDay } from "@/components/pro/inbox/text";
import { ApiError, call, errorText } from "@/lib/backend/client";
import { md } from "@/lib/format";
import { tradeLabel } from "@/lib/labels";
import { span, type Job } from "./text";
import s from "./jobs.module.css";

type Props = {
  job: Job;
  /** "김하늘 · 상계동 도배" */
  head: string;
  /** "김하늘 님" · "고객" */
  who: string;
  /** 올린 뒤 응답(새 공사 상태) */
  onSaved: (out: Job) => void;
  /** 그사이 상태가 바뀜: 다시 읽는다 */
  onStale: () => Promise<void>;
};

export function JobFinish({ job, head, who, onSaved, onStale }: Props) {
  const dlg = useRef<HTMLDialogElement>(null);
  const sent = useRef(false);
  const [busy, setBusy] = useState(false);
  const [sendErr, setSendErr] = useState("");
  const [warn, setWarn] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const st = job.status;
  const end = job.end_date;
  if (!job.start_date || !end || job.dates_state === "closed") return null;
  if (!["scheduled", "checking", "fixing", "done"].includes(st)) return null;

  const trade = tradeLabel(job.trade);
  const again = st === "fixing";
  const label = again ? "남은 일 다 했어요" : "공사 끝냈어요";
  const hasChange = job.dates_state === "change_requested" || job.dates_state === "change_proposed";
  const until = job.contact_until ? untilDay(job.contact_until) : null;

  function ask() {
    if (busy || !job.can_finish) return;
    setSendErr("");
    setWarn(null);
    dlg.current?.showModal();
  }

  async function send() {
    if (busy) return;
    setBusy(true);
    setSendErr("");
    try {
      const out = await call<Job>("POST", `/vendor/jobs/${job.deal_id}/done`);
      sent.current = true;
      dlg.current?.close();
      setWarn(null);
      const by = out.contact_until ? ` 고객 연락처는 ${untilDay(out.contact_until)}까지 보여요.` : "";
      setNote(again ? `남은 일을 다 했다고 올렸어요. ${iGa(who)} 다시 확인하면 끝나요.${by}` : `공사를 끝냈다고 올렸어요. ${iGa(who)} 확인하면 끝나요.${by}`);
      onSaved(out);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        dlg.current?.close();
        setWarn(e.message);
        await onStale();
        return;
      }
      setSendErr(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const chip = st === "checking" ? <p className="mj-st mj-st-wait"><Dash />공사 끝냄 · 고객 확인 기다림</p>
    : st === "fixing" ? <p className="mj-st mj-st-now">남은 일이 있대요</p>
    : st === "done" ? <p className="mj-st mj-st-ok mj-num"><Check />공사 끝남{until ? ` · 연락처 ${until}까지` : ""}</p>
    : null;

  const btn = (pri: boolean) => (
    <button id="j-done" type="button" className={`mj-btn ${pri ? "mj-btn-pri" : "mj-btn-sec"}`} aria-haspopup="dialog"
      aria-disabled={!job.can_finish || busy ? true : undefined} aria-describedby={job.can_finish ? undefined : "j-done-h"} onClick={ask}>
      {label}
    </button>
  );

  return (
    <section id="j-finish" aria-labelledby="jf-t" className={s.sent}>
      <div className={s.sentHead}>
        <h2 id="jf-t" className="mj-h3">공사 끝냈어요</h2>
        {chip}
      </div>
      <p className="mj-sub mj-num">{head} · 공사 {span(job.start_date, end)}</p>

      {note ? <DoneNote text={note} /> : null}
      {warn ? <p role="alert" className="mj-notice mj-notice-warn"><span><b>{warn}</b></span></p> : null}

      {st === "scheduled" ? (
        <>
          <div className={s.btns}>{btn(true)}</div>
          <p id="j-done-h" className="mj-hint mj-num">
            {job.can_finish ? `누르면 ${who}에게 확인을 받아요.` : `마지막 공사일 ${md(end)}부터 눌러져요.`}
          </p>
        </>
      ) : st === "checking" ? (
        <>
          <p className="mj-num">{job.work_done_on ? `${md(job.work_done_on)}에 끝냈다고 올렸어요` : "끝냈다고 올렸어요"}{until ? ` · 고객 연락처는 ${until}까지 보여요` : ""}</p>
          <p className="mj-small">{iGa(who)} 확인하면 끝나요. 고객이 확인하지 않아도 저절로 끝나지 않고, 그동안 연락처는 계속 보여요.</p>
        </>
      ) : st === "fixing" ? (
        <div className={`mj-notice mj-notice-warn ${s.fix}`}>
          <div className={s.fixText}>
            <p><b>{iGa(who)} 남은 일이 있대요</b></p>
            {job.fixing_note ? <p className={s.sumText}>&ldquo;{job.fixing_note}&rdquo;</p> : null}
            <p id="j-done-h" className="mj-small">다 하고 다시 올리면 고객이 다시 확인해요.</p>
          </div>
          {btn(false)}
        </div>
      ) : (
        <p className="mj-num">{job.work_done_on ? `${md(job.work_done_on)} 끝냄 · ` : ""}고객이 확인했어요.{until ? ` 고객 연락처는 ${until}까지 보여요.` : ""}</p>
      )}

      <dialog ref={dlg} className={s.dlg} aria-labelledby="jfd-t" onClose={() => { if (sent.current) { sent.current = false; return; } document.getElementById("j-done")?.focus(); }}>
        <button type="button" className={s.x} aria-label="닫기" onClick={() => dlg.current?.close()}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
        </button>
        <h2 id="jfd-t" className="mj-h3 mj-num">{again ? `${trade} 남은 일을 다 했나요?` : `${md(end)} ${trade} 공사를 끝냈나요?`}</h2>
        <p>{again
          ? `${iGa(who)} 다시 확인해요. 고객 연락처는 다시 올린 날부터 1년까지 보여요.`
          : `${iGa(who)} ‘확인했어요’를 누르면 끝나요. 고객 연락처는 끝냈다고 올린 날부터 1년까지 보여요.`}</p>
        {hasChange ? <p className="mj-small">수락 기다리던 새 날짜와 고객의 날짜 바꾸기 요청은 닫혀요. 끝낸 뒤에는 날짜를 바꿀 수 없어요.</p> : null}
        {sendErr ? <FieldError id="jfd-e" alert>{sendErr}</FieldError> : null}
        <div className={s.dlgBtns}>
          <button type="button" className="mj-btn mj-btn-sec" onClick={() => dlg.current?.close()}>돌아가기</button>
          <button type="button" className="mj-btn mj-btn-pri" onClick={() => void send()} disabled={busy}>{busy ? "올리는 중이에요" : again ? "다 했어요" : "끝냈어요"}</button>
        </div>
      </dialog>
    </section>
  );
}
