"use client";
// '요청 취소' 글자 버튼 + 확인 창 (시안 WVendors 메모 '요청 취소'). 견적서가 오기 전까지만 서버가 받는다(뒤에는 409).
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FieldError } from "@/components/auth/parts";
import { call, errorText } from "@/lib/backend/client";
import { Close } from "./icons";
import s from "./dialog.module.css";
import c from "./ContactCard.module.css";

export function CancelVisit({ projectId, visitId, name, shared }: { projectId: string; visitId: string; name: string; shared: boolean }) {
  const router = useRouter();
  const dlg = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const t = `cv-${visitId}`;

  async function go() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await call("POST", `/projects/${projectId}/visits/${visitId}/cancel`);
      dlg.current?.close();
      router.refresh();
    } catch (e) {
      setError(errorText(e));
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <>
      <button ref={opener} type="button" className={c.ghost} aria-haspopup="dialog" onClick={() => { setError(""); dlg.current?.showModal(); }}>
        요청 취소<span className="mj-sr">, {name}</span>
      </button>
      <dialog ref={dlg} className={s.dlg} aria-labelledby={`${t}-t`} onClose={() => opener.current?.focus()}>
        <button type="button" className={s.x} aria-label="닫기" onClick={() => dlg.current?.close()}><Close /></button>
        <h2 id={`${t}-t`} className="mj-h3">{name} 실측 요청을 취소할까요?</h2>
        <p>
          견적서가 오기 전까지 취소할 수 있어요. 취소하면 {name} 연락처가 가려지고 {name}에 알림이 가요.
          {shared ? ` 보낸 내 연락처도 ${name}에서 바로 가려져요.` : null}
        </p>
        {error ? <FieldError id={`${t}-e`} alert>{error}</FieldError> : null}
        <div className={s.btns}>
          <button type="button" className="mj-btn mj-btn-danger" disabled={busy} onClick={go}>{busy ? "취소하고 있어요…" : "요청 취소하기"}</button>
          <button type="button" className="mj-btn mj-btn-sec" autoFocus onClick={() => dlg.current?.close()}>돌아가기</button>
        </div>
      </dialog>
    </>
  );
}
