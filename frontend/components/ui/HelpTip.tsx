"use client";
// 도움말 아이콘(제목 옆 '!'): 누르면 바로 아래에 짧은 설명이 펼쳐져요. 다시 누르기 · Esc · 바깥 누르기로 닫혀요.
// 화면에 늘 보이던 안내 글을 여기로 옮겨요(11-19 사용자 결정: 화면 문구는 최소로).
// 펼친 칸은 화면 밖으로 넘치지 않게 좌우 끝을 화면 안쪽 12px에 맞춰요.
// only: 웹(≥768) · 폰(<768) 한쪽에만 둘 때(제목이 폰에서 숨는 화면은 폰용을 본문에 따로 둬요).
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon";
import s from "./HelpTip.module.css";

export function HelpTip({ label = "도움말", only, children }: { label?: string; only?: "web" | "phone"; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const box = useRef<HTMLSpanElement>(null);
  const pop = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  useLayoutEffect(() => {
    const el = pop.current;
    if (!open || !el) return;
    el.style.transform = "";
    const r = el.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const dx = r.right > vw - 12 ? vw - 12 - r.right : r.left < 12 ? 12 - r.left : 0;
    if (dx) el.style.transform = `translateX(${Math.round(dx)}px)`;
  }, [open]);

  const cls = [s.box, only === "web" ? s.web : only === "phone" ? s.phone : null].filter(Boolean).join(" ");
  return (
    <span ref={box} className={cls}>
      <button type="button" className={s.btn} aria-label={label} aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)}>
        <Icon name="error" size={18} />
      </button>
      <span id={id} ref={pop} role="note" className={s.pop} hidden={!open}>{children}</span>
    </span>
  );
}
