"use client";
// 폰 너비(768px 미만) 머리의 '메뉴' 버튼. 펼치면 머리 아래 전체 폭 목록(줄 48)에 주 메뉴와 계정 메뉴를 함께 둔다.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Role } from "@/lib/types";
import { ACCOUNT, NAV, VENDOR_LOCKED, isCurrent, type HeaderKind } from "./nav";
import { LockMark } from "./NavLinks";
import { logout } from "./logout";
import s from "./header.module.css";

export function MobileMenu({ kind, account, lock }: { kind: HeaderKind; account: { label: string; role: Role } | null; lock?: string | null }) {
  const router = useRouter();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const nav = NAV[kind];
  const extra = account ? ACCOUNT[account.role].filter((it) => !nav.some((n) => n.href === it.href)) : [];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); btn.current?.focus(); } };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const close = () => setOpen(false);
  return (
    <div ref={box} className={s.mbox}>
      <button ref={btn} type="button" className={`mj-btn mj-btn-sec mj-btn-sm ${s.mbtn}`} aria-expanded={open} aria-controls="mnav" onClick={() => setOpen((v) => !v)}>메뉴</button>
      <div id="mnav" className={s.mpanel} hidden={!open}>
        <nav aria-label="주 메뉴">
          <ul>
            {nav.map((l) => (
              <li key={l.id}>
                {lock && VENDOR_LOCKED.includes(l.id) ? (
                  <a className={`${s.mrow} ${s.mlocked}`} role="link" aria-disabled="true" aria-describedby="mnav-lock"><LockMark />{l.label}</a>
                ) : (
                  <Link className={s.mrow} href={l.href} aria-current={isCurrent(l, path) ? "page" : undefined} onClick={close}>{l.label}</Link>
                )}
              </li>
            ))}
          </ul>
          {lock ? <p id="mnav-lock" className={s.mnote}>{lock}</p> : null}
        </nav>
        {account ? (
          <>
            <p className={s.mgroup} id="mnav-acct">{account.label}</p>
            <ul aria-labelledby="mnav-acct">
              {extra.map((it) => (
                <li key={it.id}><Link className={s.mrow} href={it.href} aria-current={path === it.href ? "page" : undefined} onClick={close}>{it.label}</Link></li>
              ))}
              <li><button type="button" className={s.mrow} onClick={() => { close(); void logout(router); }}>로그아웃</button></li>
            </ul>
          </>
        ) : (
          <ul className={s.msep}>
            <li><Link className={s.mrow} href="/login" onClick={close}>로그인</Link></li>
            <li><Link className={s.mrow} href="/signup" onClick={close}>가입하기</Link></li>
          </ul>
        )}
      </div>
    </div>
  );
}
