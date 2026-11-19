// 본문 틀(W1 A · N2 A): [이동 경로 + 화면 제목] → [본문 | 옆 칸].
// - PageHead: 웹은 이동 경로(14 · 회색 · 밑줄 없음) + 제목 20/800 + 설명. 폰은 제목을 머리가 보여서 h1을 숨기고 설명만 보여요.
// - WithAside: ≥1024에서 오른쪽 옆 칸(320 · 넓은 웹 344). 옆 칸은 AI가 있는 화면은 AI(B5 components/ai), 없으면 요약.
//   폰 · 태블릿에서 옆 칸은 'AI에게 묻기'(AsideOpenButton)로 여는 전체 화면 층이 돼요(?ai=1, 뒤로 가기로 닫힘).
//   폰은 머리 오른쪽에 그 단추를 두고(AppHeader phone.action), 태블릿(768~1023)은 웹 머리라 WithAside가 본문 위에 단추를 하나 그려요.
import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { AsideOpenButton, AsideSlot } from "./AsideSlot";
import s from "./frame.module.css";

export type Crumb = { label: string; href?: string };

export function PageHead({ title, crumbs, desc, badge, action, phoneTitle = false }: {
  title: string;
  /** 이동 경로(마지막 줄은 지금 화면, href 없이) */
  crumbs?: Crumb[];
  /** 제목 옆 설명(14) · 폰에서는 본문 첫 줄 */
  desc?: ReactNode;
  badge?: ReactNode;
  /** 제목 오른쪽 글자 단추 하나 */
  action?: ReactNode;
  /** 폰에서도 제목을 보여요(머리가 로고형일 때) */
  phoneTitle?: boolean;
}) {
  return (
    <div className={s.head}>
      {crumbs?.length ? (
        <nav aria-label="이동 경로" className={s.crumb}>
          <ol>
            {crumbs.map((c, i) => (
              <li key={`${c.label}-${i}`}>
                {i > 0 ? <Icon name="chevron-right" size={14} className={s.sep} /> : null}
                {c.href ? <Link href={c.href}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
      <div className={s.titleRow}>
        <h1 className={phoneTitle ? s.title : `${s.title} ${s.webOnly}`}>{title}</h1>
        {badge}
        {desc ? <p className={s.desc}>{desc}</p> : null}
        {action ? <div className={s.act}>{action}</div> : null}
      </div>
    </div>
  );
}

/** 본문 묶음 사이 간격 · 옆 여백 · 최대 너비를 맞춘 바깥 칸. id="main"은 건너뛰기 링크가 가는 곳이에요 */
export function Main({ children, narrow, className }: { children: ReactNode; narrow?: boolean; className?: string }) {
  return <main id="main" className={[s.main, narrow ? s.narrow : null, className].filter(Boolean).join(" ")}>{children}</main>;
}

/** [본문 | 옆 칸]. aside가 없으면 본문 한 줄. label은 폰 전체 화면 층 · 옆 칸의 이름이에요 */
export function WithAside({ children, aside, label = "AI 채팅" }: { children: ReactNode; aside?: ReactNode; label?: string }) {
  return (
    <div className={aside ? `${s.frame} ${s.hasAside}` : s.frame}>
      {aside ? <div className={s.tabletOpen}><AsideOpenButton>{label}</AsideOpenButton></div> : null}
      <div className={s.body}>{children}</div>
      {aside ? <AsideSlot label={label}>{aside}</AsideSlot> : null}
    </div>
  );
}
