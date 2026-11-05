"use client";
// 내 정보의 버튼들 (시안 WAccount 02 · 회원 탈퇴 메모).
// - SoonButton: 서버 기능이 아직 없는 버튼(비밀번호 바꾸기 · 카카오 연결). 누르면 그 줄 아래에 준비 중 안내만 보인다.
// - LogoutButton: 로그아웃.
// - WithdrawButton: '회원 탈퇴'를 누르면 확인 창에서 지우는 것을 보이고 비밀번호를 다시 받아 POST /me/withdraw.
//   진행 중인 공사가 있어도 막지 않는다(개인정보 보호법 제38조④: 가입보다 어렵게 하지 않음).
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { call, errorText } from "@/lib/backend/client";
import { logout } from "@/components/site/logout";
import { writeDraft } from "@/components/start/draft";
import s from "./account.module.css";
import d from "@/components/vendors/dialog.module.css";

export function SoonButton({ label, soon }: { label: string; soon: string }) {
  const [shown, setShown] = useState(false);
  return (
    <span className={s.soon}>
      <button type="button" className="mj-btn mj-btn-sec mj-btn-sm" aria-expanded={shown} onClick={() => setShown(true)}>{label}</button>
      {shown ? <span className="mj-small" role="status">{soon}</span> : null}
    </span>
  );
}

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button type="button" className="mj-btn mj-btn-sec mj-btn-sm" disabled={busy} onClick={async () => { setBusy(true); await logout(router); }}>
      {busy ? "로그아웃 중…" : "로그아웃"}
    </button>
  );
}

const X = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
);

export function WithdrawButton({ vendor }: { vendor: boolean }) {
  const router = useRouter();
  const dlg = useRef<HTMLDialogElement>(null);
  const pw = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const items = vendor
    ? ["회원 정보 (이름 · 이메일)", "사업자등록증과 업체 정보", "로그인 기록"]
    : ["회원 정보 (이름 · 휴대폰 · 이메일)", "만든 공사와 표준견적서 · 사진 · 도면", "로그인 기록", "진행 중인 공사 기록과 업체에 보이던 연락처"];

  function open() { setErr(""); dlg.current?.showModal(); setTimeout(() => pw.current?.focus(), 0); }
  function close() { dlg.current?.close(); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const password = pw.current?.value ?? "";
    if (!password) { setErr("비밀번호를 적어 주세요."); pw.current?.focus(); return; }
    setErr(""); setBusy(true);
    try {
      await call("POST", "/me/withdraw", { password });
      writeDraft(null); // 이 브라우저에 남은 쓰던 요청서도 지운다
      router.push("/?bye=1");
      router.refresh();
    } catch (er) {
      setErr(errorText(er));
      setBusy(false);
      pw.current?.focus();
    }
  }

  return (
    <>
      <button ref={opener} type="button" className={s.wd} aria-haspopup="dialog" onClick={open}>회원 탈퇴</button>
      <dialog ref={dlg} className={d.dlg} aria-labelledby="wd-t" onClose={() => opener.current?.focus()}>
        <button type="button" className={d.x} aria-label="닫기" onClick={close}><X /></button>
        <h2 id="wd-t" className="mj-h3">탈퇴할까요?</h2>
        <p>탈퇴하면 아래 정보를 바로 지워요. 지운 정보는 되살릴 수 없어요.</p>
        <ul className={s.del}>{items.map((t) => <li key={t}>{t}</li>)}</ul>
        <form className={s.wdForm} noValidate onSubmit={submit} aria-label="탈퇴 확인">
          <div className="mj-field">
            <label className="mj-label" htmlFor="wd-pw">비밀번호 <span className="mj-opt">(필수)</span></label>
            <input ref={pw} id="wd-pw" type="password" autoComplete="current-password" className="mj-input" aria-invalid={err ? true : undefined} aria-describedby={err ? "wd-err" : undefined} />
            {err ? <p id="wd-err" className="mj-error" role="alert">{err}</p> : null}
          </div>
          <div className={s.wdBtns}>
            <button type="button" className="mj-btn mj-btn-sec" onClick={close} disabled={busy}>그만두기</button>
            <button type="submit" className="mj-btn mj-btn-danger" disabled={busy}>{busy ? "지우는 중…" : "탈퇴하기"}</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
