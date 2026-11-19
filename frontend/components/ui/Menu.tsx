"use client";
// 작은 메뉴(웹 ≥ 768) ↔ 아래 시트(폰). W2 A: 메뉴는 누른 단추 옆에 붙어요(⋯ · + · 이름 ▾ · 지금 할 일 ▾).
// 웹: 240px · 줄 44 · Esc · 바깥 누르기로 닫고 단추로 초점을 돌려줘요. 폰: 같은 줄을 시트(OptionRow)로 보여요.
// 펼침 단추(disclosure) 방식이라 화살표 키 규칙(role=menu)은 쓰지 않아요. Tab으로 줄을 옮겨 다녀요.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { MQ } from "@/components/site/breakpoints";
import { Icon, type IconName } from "./Icon";
import { OptionRow, Sheet } from "./Sheet";
import s from "./Menu.module.css";

export type MenuItem = { label: string; href?: string; onSelect?: () => void; danger?: boolean; disabled?: boolean; hint?: ReactNode };

export function Menu({ label, icon, text, title, items, align = "end", className }: {
  /** 단추 이름(아이콘만이면 꼭): ⋯ '더 보기' · + '더 보내기' */
  label: string;
  /** 아이콘 단추(⋯ more · + plus). 없으면 글자 단추 + ▾ */
  icon?: IconName;
  /** 글자 단추에 보이는 글(없으면 label) */
  text?: ReactNode;
  /** 폰 시트 제목(없으면 label) */
  title?: string;
  items: MenuItem[];
  align?: "start" | "end";
  className?: string;
}) {
  const [open, setOpen] = useState<"pop" | "sheet" | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (open !== "pop") return;
    popRef.current?.querySelector<HTMLElement>("a, button:not([aria-disabled='true'])")?.focus();
    const onDown = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(null); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(null); btn.current?.focus(); } };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const router = useRouter();
  const toggle = () => setOpen((v) => (v ? null : window.matchMedia(MQ.tablet).matches ? "pop" : "sheet"));
  const pick = (it: MenuItem) => { if (it.disabled) return; setOpen(null); it.onSelect?.(); };
  // 폰 시트는 열 때 기록 한 칸을 넣어 뒤로 가기로 닫혀요. 시트에서 다른 화면으로 갈 때는 그 칸을 먼저 걷고 옮겨요.
  const go = (href: string) => {
    const willPop = Boolean(history.state?.mjModal);
    setOpen(null);
    if (!willPop) { router.push(href); return; }
    const once = () => { window.removeEventListener("popstate", once); router.push(href); };
    window.addEventListener("popstate", once);
  };

  return (
    <div ref={box} className={[s.wrap, className].filter(Boolean).join(" ")}>
      <button
        ref={btn}
        type="button"
        className={icon ? s.iconBtn : s.textBtn}
        aria-label={icon ? label : undefined}
        aria-expanded={open !== null}
        aria-controls={open === "pop" ? `${id}-pop` : undefined}
        onClick={toggle}
      >
        {icon ? <Icon name={icon} /> : <><span>{text ?? label}</span><Icon name="chevron-down" size={16} className={s.chev} /></>}
      </button>
      {open === "pop" ? (
        <div ref={popRef} id={`${id}-pop`} className={`${s.pop} ${align === "start" ? s.start : s.end}`}>
          <ul>
            {items.map((it) => (
              <li key={it.label}>
                {it.href && !it.disabled ? (
                  <Link className={`${s.row} ${it.danger ? s.danger : ""}`} href={it.href} onClick={() => setOpen(null)}>{it.label}{it.hint ? <small>{it.hint}</small> : null}</Link>
                ) : (
                  <button type="button" className={`${s.row} ${it.danger ? s.danger : ""}`} aria-disabled={it.disabled || undefined} onClick={() => pick(it)}>{it.label}{it.hint ? <small>{it.hint}</small> : null}</button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <Sheet open={open === "sheet"} onClose={() => setOpen(null)} title={title ?? label}>
        <div role="list">
          {items.map((it) => (
            <div role="listitem" key={it.label}>
              <OptionRow danger={it.danger} disabled={it.disabled} onClick={() => (it.href ? go(it.href) : pick(it))}>{it.label}</OptionRow>
            </div>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
