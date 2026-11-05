"use client";
// '번호 복사': 고객이 보낸 휴대폰 번호를 클립보드에 넣는다. 못 넣으면 번호를 직접 고르게 안내한다.
import { useState } from "react";
import s from "./inbox.module.css";

export function CopyPhone({ phone, name }: { phone: string; name: string }) {
  const [msg, setMsg] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(phone);
      setMsg("번호를 복사했어요.");
    } catch {
      setMsg("복사하지 못했어요. 번호를 길게 눌러 복사해 주세요.");
    }
  }
  return (
    <>
      <button type="button" className="mj-btn mj-btn-sec mj-btn-sm" aria-label={`${name} 번호 복사`} onClick={() => void copy()}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" className={s.ico}><rect x="4.5" y="4.5" width="7.5" height="7.5" rx="1" /><path d="M9.5 4.5V2.5a.5.5 0 00-.5-.5H2.5a.5.5 0 00-.5.5V9a.5.5 0 00.5.5h2" /></svg>
        번호 복사
      </button>
      <span role="status" className={`mj-small ${s.copied}`}>{msg}</span>
    </>
  );
}
