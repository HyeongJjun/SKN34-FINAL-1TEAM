"use client";
// 아래 탭 바 모양 · 지금 탭(aria-current). 아이콘 24 + 글자 13(9판 11 → 13), 꺼진 탭 글자 5.33:1(9판 2.0:1).
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/types";
import { Count } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { useLiveUnread } from "./LiveProvider";
import { isCurrent, type TabItem } from "./nav";
import s from "./tabbar.module.css";

export function TabBarNav({ tabs, counts, role }: { tabs: TabItem[]; counts: { notify: number }; role: Role }) {
  const path = usePathname() ?? "";
  const notify = useLiveUnread(counts.notify);
  return (
    <nav className={s.bar} aria-label={role === "vendor" ? "업체 탭" : "고객 탭"} data-mj-tabbar="" style={{ ["--tabs" as string]: tabs.length }}>
        {tabs.map((t) => {
          const n = t.count === "notify" ? notify : 0;
          const on = isCurrent(t, path);
          return (
            <Link key={t.id} href={t.href} className={s.tab} aria-current={on ? "page" : undefined} aria-label={n > 0 ? `${t.label}, 새 알림 ${n}개` : undefined}>
              <span className={s.ic}><Icon name={t.icon} /><Count n={n} className={s.count} /></span>
              <span>{t.label}</span>
            </Link>
          );
        })}
      </nav>
  );
}
