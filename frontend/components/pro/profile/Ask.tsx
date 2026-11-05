"use client";
// 뺄까요? 확인 (시안 메모 '파일 · 공정을 뺄 때'). 뺄 것 바로 아래에 열고, 열리면 질문으로 초점을 옮긴다.
// '그대로 두기'를 누르면 처음 누른 '빼기' 버튼(back)으로 초점을 돌린다.
import { useEffect, useId, useRef } from "react";
import s from "./Profile.module.css";

type Props = { text: string; yes: string; onYes: () => void; onNo: () => void; busy?: boolean; back?: string };

export function Ask({ text, yes, onYes, onNo, busy, back }: Props) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { box.current?.focus(); }, []);
  function no() {
    onNo();
    if (back) setTimeout(() => document.getElementById(back)?.focus(), 0);
  }
  return (
    <div ref={box} tabIndex={-1} role="group" aria-labelledby={id} className={`mj-notice mj-notice-warn ${s.ask}`}
      onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); no(); } }}>
      <p id={id}>{text}</p>
      <div>
        <button type="button" className="mj-btn mj-btn-danger" onClick={onYes} disabled={busy}>{busy ? "빼는 중이에요" : yes}</button>
        <button type="button" className="mj-btn mj-btn-sec" onClick={no} disabled={busy}>그대로 두기</button>
      </div>
    </div>
  );
}
