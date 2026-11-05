"use client";
// 결정을 저장하고 다음 신청을 연 뒤의 한 줄 (시안 WAdmin '저장한 뒤'). 열리면 초점을 옮겨 화면 읽기에도 알린다.
import { useEffect, useRef } from "react";

export function SavedNote({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => { ref.current?.focus(); }, [text]);
  return (
    <p ref={ref} tabIndex={-1} role="status" className={className}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M2.5 7.5l3 3 6-7" /></svg>
      {text}
    </p>
  );
}
