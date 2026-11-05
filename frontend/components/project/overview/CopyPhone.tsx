"use client";
// 업체 번호 복사. 복사하지 못하면(권한 · 오래된 브라우저) 화면의 번호를 선택해 두고 글로 알린다(role=status).
import { useState } from "react";
import s from "./Overview.module.css";

export function CopyPhone({ phone, targetId, aria }: { phone: string; targetId: string; aria: string }) {
  const [said, setSaid] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(phone);
      setSaid("복사했어요");
    } catch {
      const el = document.getElementById(targetId);
      const sel = window.getSelection();
      if (el && sel) {
        const r = document.createRange();
        r.selectNodeContents(el);
        sel.removeAllRanges();
        sel.addRange(r);
      }
      setSaid("복사하지 못했어요. 번호를 선택해 뒀으니 길게 눌러 복사해 주세요.");
    }
  }
  return (
    <>
      <button type="button" className={`mj-btn mj-btn-sec ${s.ctBtn}`} aria-label={aria} onClick={copy}>번호 복사</button>
      <span className={`mj-small ${s.said}`} role="status">{said}</span>
    </>
  );
}
