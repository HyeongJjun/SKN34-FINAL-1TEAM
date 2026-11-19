"use client";
// 웹 머리 오른쪽 '이름 ▾' 펼침. 고객: 내 정보 · 자주 묻는 질문, 업체: 내 정보, 관리자: 로그아웃만(+ 늘 로그아웃).
// 펼침 단추(disclosure) 방식: Esc나 바깥을 누르면 닫히고, Esc로 닫으면 초점이 단추로 돌아와요.
import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Role } from "@/lib/types";
import { Icon } from "@/components/ui/Icon";
import { ACCOUNT } from "./nav";
import { logout } from "./logout";
import s from "./header.module.css";

export function AccountMenu({ label, role }: { label: string; role: Role }) {
  const router = useRouter();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); btn.current?.focus(); } };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div ref={box} className={s.pop}>
      <button ref={btn} type="button" className={s.acctBtn} aria-expanded={open} aria-controls={`${id}-menu`} onClick={() => setOpen((v) => !v)}>
        <span>{label}</span>
        <Icon name="chevron-down" size={16} className={s.chev} />
      </button>
      <div id={`${id}-menu`} className={s.menu} hidden={!open}>
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
