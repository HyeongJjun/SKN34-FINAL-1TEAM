"use client";
// '이 요청 못 받아요' + 확인 창 (시안 WVInbox 메모). 이유 3종 중 하나를 꼭 고른다.
// 견적서를 보내기 전(요청함)에만 된다. 이미 닫혔으면 API가 409로 알려 주고, 그 문장을 창 안에 보인다.
// 받지 않으면 작업함으로 돌아가 한 줄 안내(?declined=)를 보인다. 줄은 끝남 탭으로 간다.
import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, call, errorText } from "@/lib/backend/client";
import { DECLINE_LABEL } from "@/lib/labels";
import s from "./inbox.module.css";

type Code = keyof typeof DECLINE_LABEL;
const CODES = Object.keys(DECLINE_LABEL) as Code[];

type Props = {
  visitId: string;
  /** 고객 이름(연락처를 보냈을 때) */
  name: string | null;
  /** 요청 번호 (이름이 없을 때 부르는 말) */
  code: string;
};

export function DeclineButton({ visitId, name, code }: Props) {
  const router = useRouter();
  const id = useId();
  const dlg = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const first = useRef<HTMLInputElement>(null);
  const [pick, setPick] = useState<Code | "">("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [closed, setClosed] = useState(false); // 다른 곳에서 먼저 닫힘(409)
  const who = name ? `${name} 님` : code;

  function open() {
    setPick("");
    setErr("");
    dlg.current?.showModal();
    first.current?.focus();
  }

  async function send() {
    if (busy) return;
    if (!pick) { setErr("이유를 골라 주세요."); first.current?.focus(); return; }
    setBusy(true);
    setErr("");
    try {
      await call("POST", `/vendor/visits/${visitId}/decline`, { code: pick });
      dlg.current?.close();
      router.push(`/vendor?declined=${visitId}`);
      router.refresh();
    } catch (e) {
      setBusy(false);
      setErr(errorText(e));
      if (e instanceof ApiError && (e.status === 409 || e.status === 404)) setClosed(true);
    }
  }

  function onClose() {
    if (closed) { router.refresh(); return; }
    if (!busy) opener.current?.focus();
  }

  return (
    <>
      <button ref={opener} type="button" className={s.no} aria-haspopup="dialog" onClick={open}>
        이 요청 못 받아요<span className="mj-sr">, {name ?? code}</span>
      </button>
      <dialog ref={dlg} className={s.dlg} aria-labelledby={`${id}-t`} onClose={onClose}>
        <button type="button" className={s.x} aria-label="닫기" onClick={() => dlg.current?.close()}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
        </button>
        <h2 id={`${id}-t`} className="mj-h3">{who} 실측 요청을 받지 않을까요?</h2>
        <fieldset className="mj-fieldset" aria-describedby={err ? `${id}-e` : undefined} disabled={busy || closed}>
          <legend className="mj-label">이유 (필수)</legend>
          <div className={s.rads}>
            {CODES.map((k, i) => (
              <label key={k} className={s.rad}>
                <input ref={i === 0 ? first : undefined} type="radio" name={`${id}-why`} value={k} checked={pick === k} required
                  aria-invalid={err && !pick ? true : undefined} onChange={() => { setPick(k); setErr(""); }} />
                {DECLINE_LABEL[k]}
              </label>
            ))}
          </div>
        </fieldset>
        <p>요청이 닫히고 서로 연락처가 바로 가려져요. 고객에게 고른 이유가 보여요.</p>
        {err ? <p id={`${id}-e`} role="alert" className="mj-error">{err}</p> : null}
        <div className={s.dlgBtns}>
          <button type="button" className="mj-btn mj-btn-sec" onClick={() => dlg.current?.close()}>돌아가기</button>
          {closed ? null : (
            <button type="button" className="mj-btn mj-btn-danger" onClick={() => void send()} disabled={busy}>
              {busy ? "닫는 중이에요" : "못 받아요"}
            </button>
          )}
        </div>
      </dialog>
    </>
  );
}
