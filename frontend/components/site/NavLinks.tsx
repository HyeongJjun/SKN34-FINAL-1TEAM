"use client";
// 머리 주 메뉴 링크. 지금 보는 화면에 aria-current="page"를 붙인다.
// lock: 승인 전 업체면 작업함 · 일정을 잠그고(누를 수 없음) 잠금 문구를 옆에 둔다.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV, VENDOR_LOCKED, isCurrent, type HeaderKind } from "./nav";
import s from "./header.module.css";

export function LockMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="2.5" y="6.2" width="9" height="6.3" rx="1" />
      <path d="M4.6 6.2V4.4a2.4 2.4 0 0 1 4.8 0v1.8" />
    </svg>
  );
}

export function NavLinks({ kind, className, lock }: { kind: HeaderKind; className?: string; lock?: string | null }) {
  const path = usePathname();
  return (
    <>
      {NAV[kind].map((l) =>
        lock && VENDOR_LOCKED.includes(l.id) ? (
          <a key={l.id} role="link" aria-disabled="true" aria-describedby="nav-lock" className={[className, s.locked].filter(Boolean).join(" ")}><LockMark />{l.label}</a>
        ) : (
          <Link key={l.id} href={l.href} className={className} aria-current={isCurrent(l, path) ? "page" : undefined}>{l.label}</Link>
        ),
      )}
      {lock ? <span id="nav-lock" className={s.lockMsg}>{lock}</span> : null}
    </>
  );
}
