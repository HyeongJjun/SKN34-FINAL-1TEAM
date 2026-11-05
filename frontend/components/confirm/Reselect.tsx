"use client";
// '○○ 업체 다시 고르기' 버튼 + 확인 창 (시안 WCompare · WConfirm '다시 고르기를 누르면').
// 확정 전(비교)은 POST /projects/{id}/visits/reselect {trade}, 확정 뒤(공사 날짜 수락 전)는 POST /projects/{id}/deals/{deal_id}/reselect.
// 끝나면 업체 고르기로 간다(그 화면이 '다시 고르는 중'을 보인다). 409(그사이 날짜 수락 · 이미 다시 고름)는 창에 까닭을 보이고,
// 창을 닫을 때 화면을 새로 읽는다.
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FieldError } from "@/components/auth/parts";
import { Close } from "@/components/vendors/icons";
import { ApiError, call, errorText } from "@/lib/backend/client";
import { tradeLabel } from "@/lib/labels";
import d from "@/components/vendors/dialog.module.css";

type Props = {
  projectId: string;
  trade: string;
  /** 확정 뒤면 그 확정 id. 없으면 확정 전이라 이 공정의 실측 요청을 모두 닫는다 */
  dealId?: string;
  /** 확인 창 제목 · 본문 · 작은 글 (무엇이 닫히는지) */
  title: string;
  body: string;
  note?: string;
};

export function Reselect({ projectId, trade, dealId, title, body, note }: Props) {
  const router = useRouter();
  const dlg = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const stale = useRef(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const t = `rs-${dealId ?? trade}`;

  async function go() {
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      if (dealId) await call("POST", `/projects/${projectId}/deals/${dealId}/reselect`);
      else await call("POST", `/projects/${projectId}/visits/reselect`, { trade });
      router.push(`/projects/${projectId}/vendors?trade=${trade}`);
      return; // 옮겨 갈 때까지 '닫는 중'을 둔다
    } catch (e) {
      if (e instanceof ApiError && e.status === 0) setErr("연결이 끊겨 다시 고르지 못했어요. 다시 눌러 주세요.");
      else {
        setErr(errorText(e));
        stale.current = true;
      }
    }
    setBusy(false);
  }

  function closed() {
    opener.current?.focus();
    if (stale.current) {
      stale.current = false;
      router.refresh();
    }
  }

  return (
    <>
      <button ref={opener} type="button" className="mj-btn mj-btn-danger" aria-haspopup="dialog" onClick={() => { setErr(""); dlg.current?.showModal(); }}>
        {tradeLabel(trade)} 업체 다시 고르기
      </button>
      <dialog ref={dlg} className={d.dlg} aria-labelledby={`${t}-t`} aria-describedby={`${t}-b`} onClose={closed}>
        <button type="button" className={d.x} aria-label="닫기" onClick={() => dlg.current?.close()}><Close /></button>
        <h2 id={`${t}-t`} className="mj-h3">{title}</h2>
        <p id={`${t}-b`}>{body}</p>
        {note ? <p className="mj-small">{note}</p> : null}
        {err ? <FieldError id={`${t}-e`} alert>{err}</FieldError> : null}
        <div className={d.btns}>
          <button type="button" className="mj-btn mj-btn-danger" aria-disabled={busy || undefined} onClick={() => void go()}>{busy ? "닫는 중이에요…" : "닫고 다시 고르기"}</button>
          <button type="button" className="mj-btn mj-btn-sec" autoFocus onClick={() => dlg.current?.close()}>그대로 두기</button>
        </div>
        <p className="mj-sr" role="status">{busy ? "다시 고르는 중이에요" : ""}</p>
      </dialog>
    </>
  );
}
