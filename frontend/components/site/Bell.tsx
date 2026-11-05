// 머리의 알림 종. 안 읽은 수는 부르는 쪽(SiteHeader → lib/api/notify.ts)이 넘긴다. 0이면 배지를 두지 않는다.
import Link from "next/link";
import s from "./header.module.css";

export function Bell({ unread, href = "/notifications" }: { unread: number; href?: string }) {
  const label = unread > 0 ? `알림, 안 읽은 알림 ${unread}개` : "알림";
  return (
    <Link href={href} className={`mj-btn mj-btn-sec mj-btn-sm ${s.bell}`} aria-label={label}>
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 8.5a5 5 0 0 1 10 0c0 4 1.5 5.5 1.5 5.5h-13S5 12.5 5 8.5z" />
        <path d="M8.3 16.5a1.8 1.8 0 0 0 3.4 0" />
      </svg>
      {unread > 0 ? <span className={s.badge} aria-hidden="true">{unread > 99 ? "99+" : unread}</span> : null}
    </Link>
  );
}
