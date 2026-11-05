// 머리 모양. 로그인한 사람(session)을 받아 역할별 머리 하나를 그린다.
// 서버(SiteHeader)와 브라우저(app/error.tsx) 양쪽에서 쓰므로 서버 전용 코드를 넣지 않는다.
import Link from "next/link";
import type { Session } from "@/lib/types";
import { AccountMenu } from "./AccountMenu";
import { Bell } from "./Bell";
import { MobileMenu } from "./MobileMenu";
import { NavLinks } from "./NavLinks";
import { LOGO_HREF, LOGO_TAG, accountLabel, vendorLock, type HeaderKind } from "./nav";
import s from "./header.module.css";

function LogoMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <path d="M3 12L13 4l10 8" stroke="var(--ink)" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M6 10.5V22h14V10.5" stroke="var(--ink)" strokeWidth="2.2" />
      <path d="M9.5 15.5l2.6 2.6 4.6-5" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** pending: 누가 로그인했는지 아직 모를 때(오류 화면) 로고만 그린다. */
export function HeaderBar({ session, admin = false, unread = 0, pending = false }: { session: Session | null; admin?: boolean; unread?: number; pending?: boolean }) {
  const kind: HeaderKind = admin ? "admin" : session ? session.role : "guest";
  const tag = LOGO_TAG[kind];
  const account = session && kind !== "guest" ? { label: accountLabel({ name: session.name, role: kind }), role: kind } : null;
  // 승인 전 업체: 작업함 · 일정 잠금 (심사 중 · 보완 요청 · 거절)
  const lock = kind === "vendor" ? vendorLock(session?.vendorStatus) : null;
  return (
    <header className={s.header}>
      <div className={`mj-wrap ${s.in}`}>
        <Link href={LOGO_HREF[kind]} className={s.logo}><LogoMark />믿집{tag ? <small>{tag}</small> : null}</Link>
        {pending ? null : (
          <>
            <nav aria-label="주 메뉴" className={s.nav}><NavLinks kind={kind} lock={lock} /></nav>
            <div className={s.who}>
              {kind === "customer" || kind === "vendor" ? <Bell unread={unread} /> : null}
              {account ? (
                <div className={s.wide}><AccountMenu label={account.label} role={account.role} /></div>
              ) : (
                <div className={s.wide}>
                  <Link href="/login" className="mj-btn mj-btn-sec mj-btn-sm">로그인</Link>
                  <Link href="/signup" className="mj-btn mj-btn-sec mj-btn-sm">가입</Link>
                </div>
              )}
              <MobileMenu kind={kind} account={account} lock={lock} />
            </div>
          </>
        )}
      </div>
    </header>
  );
}
