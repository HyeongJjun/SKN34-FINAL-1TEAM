"use client";
// 요청을 받지 않은 뒤 작업함 맨 위 한 줄. 열리면 초점을 옮겨 화면 읽기에도 알린다.
import { useEffect, useRef } from "react";
import s from "./inbox.module.css";

export function DoneNote({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => { ref.current?.focus(); }, [text]);
  return (
    <p ref={ref} tabIndex={-1} role="status" className="mj-notice">
      <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="var(--ok)" strokeWidth="2" aria-hidden="true" className={`${s.ico} ${s.noteIco}`}><path d="M2.5 7.5l3 3 6-7" /></svg>
      <span>{text}</span>
    </p>
  );
}
