"use client";
// 머리 오른쪽 '○○ 님' 메뉴. 고객: 내 공사 · 내 정보, 업체: 업체 정보 · 내 정보, 관리자: 로그아웃만.
// 펼침 버튼(disclosure) 방식: Esc나 바깥을 누르면 닫히고, Esc로 닫으면 초점이 버튼으로 돌아온다.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Role } from "@/lib/types";
import { ACCOUNT } from "./nav";
import { logout } from "./logout";
import s from "./header.module.css";

export function AccountMenu({ label, role }: { label: string; role: Role }) {
  const router = useRouter();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); btn.current?.focus(); } };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div ref={box} className={s.acct}>
      <button ref={btn} type="button" className={`mj-btn mj-btn-sec mj-btn-sm ${s.acctBtn}`} aria-expanded={open} aria-controls="acct-menu" onClick={() => setOpen((v) => !v)}>
        <span>{label}</span>
        <svg className={s.chev} width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M2.5 4.5L6 8l3.5-3.5" /></svg>
      </button>
      <div id="acct-menu" className={s.menu} hidden={!open}>
        <ul>
          {ACCOUNT[role].map((it) => (
            <li key={it.id}><Link className={s.mrow} href={it.href} aria-current={path === it.href ? "page" : undefined} onClick={() => setOpen(false)}>{it.label}</Link></li>
          ))}
          <li><button type="button" className={s.mrow} onClick={() => logout(router)}>로그아웃</button></li>
        </ul>
      </div>
    </div>
  );
}
