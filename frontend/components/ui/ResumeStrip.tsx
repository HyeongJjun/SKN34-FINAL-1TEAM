// 진행 중 공사 띠(design-system 3.1 ResumeStrip · 9판 k-strip · S5 A): 어두운 띠 · 흰 글 16/700 · 파란 배지 · ›.
// 폰 홈 맨 위(C40 C41) · 웹 머리 아래 한 줄(D10). 띠 전체가 그 공사로 가는 링크예요(56 이상).
import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "./Icon";
import s from "./ResumeStrip.module.css";

export function ResumeStrip({ href, title, sub, badge, className }: {
  href: string;
  /** '상계동 아파트 도배' */
  title: ReactNode;
  /** '지금: 마루와벽 날짜 고르기 · 11.25(수)까지' */
  sub?: ReactNode;
  /** '진행 중' · '할 일 2' */
  badge?: ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={[s.strip, className].filter(Boolean).join(" ")}>
      {badge ? <span className={s.badge}>{badge}</span> : null}
      <span className={s.body}>
        <b className={s.title}>{title}</b>
        {sub ? <span className={s.sub}>{sub}</span> : null}
      </span>
      <Icon name="chevron-right" size={20} className={s.chev} />
    </Link>
  );
}
