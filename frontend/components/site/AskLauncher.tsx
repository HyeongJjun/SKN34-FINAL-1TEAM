"use client";
// 오른쪽 아래 '묻기' 버튼과 떠 있는 창 틀 (시안 WProjectBChat · B안). 상담 챗은 보류라 지금은 틀만 있다:
// 창에는 준비 중 안내와 자주 묻는 질문 링크만 있고, 입력 칸 · 보내기는 막아 둔다. 상담을 붙일 때 이 창 안을 채운다.
// 창은 380 × 560, 폰(600px 아래)에서는 아래에서 올라오는 창. 닫기(X) · Esc로 닫고 '묻기' 버튼으로 돌아간다.
// 업체 자세히 오른쪽 창이 열려 있으면 버튼이 창 왼쪽으로 비킨다(AskLauncher.module.css).
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import s from "./AskLauncher.module.css";

const Bubble = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="M5 3.5h10A1.5 1.5 0 0 1 16.5 5v6.5A1.5 1.5 0 0 1 15 13H9.5L6 16v-3H5a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 5 3.5z" /></svg>
);
const X = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
);

export function AskLauncher() {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const title = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!open) return;
    title.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || document.querySelector("dialog[open]")) return;
      setOpen(false);
      btn.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function close() { setOpen(false); btn.current?.focus(); }

  return (
    <>
      {open ? (
        <section id="ask-win" className={s.win} aria-labelledby="ask-t">
          <div className={s.hd}>
            <h2 id="ask-t" ref={title} tabIndex={-1} className={s.t}>묻기</h2>
            <button type="button" className={s.x} aria-label="묻기 창 닫기" onClick={close}><X /></button>
          </div>
          <div className={s.log}>
            <p className={s.soon}>공사 질문 답변은 준비 중이에요.</p>
            <p className="mj-small">자주 묻는 질문에서 먼저 찾아볼 수 있어요.</p>
            <Link className="mj-lnk" href="/faq">자주 묻는 질문 보기</Link>
          </div>
          <form className={s.fm} onSubmit={(e) => e.preventDefault()} aria-label="질문 보내기">
            <label className="mj-sr" htmlFor="ask-q">질문</label>
            <textarea id="ask-q" className={`mj-textarea ${s.q}`} rows={1} placeholder="준비 중이에요" disabled />
            <button type="submit" className="mj-btn mj-btn-pri mj-btn-sm" disabled>보내기</button>
          </form>
        </section>
      ) : null}
      <button ref={btn} type="button" className={s.launch} aria-expanded={open} aria-controls="ask-win" onClick={() => (open ? close() : setOpen(true))}>
        <Bubble />묻기
      </button>
    </>
  );
}
