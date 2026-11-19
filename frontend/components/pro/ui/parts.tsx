// 업체 · 관리자 화면이 같이 쓰는 작은 조각(B3). B4 ui에 아직 없는 것만 여기 둬요(design-system 3장 '다음 차례'):
// 묶음(Group) · 줄 목록(Rows/Row, 누를 줄 포함) · 사진 자리(Pics, 주소 없는 사진) · 인용(Quote) · 첫 묶음(Hero).
// B4가 같은 조각을 내면 그것으로 바꿔요(verification/b3.md '부탁'). 상태가 없어서 서버 화면에서 그대로 써요.
import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import s from "./parts.module.css";

const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(" ");

/** 묶음(흰 칸 · 모서리 20). title이 있으면 묶음 제목(18/700)과 오른쪽 글자 단추 하나 */
export function Group({ children, title, action, flush, className, as: Tag = "section", id }: {
  children: ReactNode;
  title?: ReactNode;
  action?: ReactNode;
  /** 줄 목록 묶음: 안쪽 위아래 여백을 줄 목록이 맡아요 */
  flush?: boolean;
  className?: string;
  as?: "section" | "div";
  id?: string;
}) {
  return (
    <Tag className={cx(s.group, flush && s.flush, className)} id={id}>
      {title || action ? (
        <div className={s.gh}>
          {title ? <h2 className={s.gt}>{title}</h2> : <span />}
          {action}
        </div>
      ) : null}
      {children}
    </Tag>
  );
}

/** 묶음 안 작은 제목(14/600) */
export function Eyebrow({ children, as: Tag = "p" }: { children: ReactNode; as?: "p" | "h2" | "h3" }) {
  return <Tag className={s.eb}>{children}</Tag>;
}

/** 각주 · 기한 한 줄(13~14). red: 기한 안내(9판 k-sm red) */
export function Small({ children, red, className }: { children: ReactNode; red?: boolean; className?: string }) {
  return <p className={cx(s.sm, red && s.red, className)}>{children}</p>;
}

/** 줄 목록(왼쪽 이름 · 아래 설명, 오른쪽 값). 누를 줄이면 줄 전체가 링크(›) */
export function Rows({ children, label }: { children: ReactNode; label?: string }) {
  return <ul className={s.rows} aria-label={label}>{children}</ul>;
}
export function Row({ label, sub, value, href, external, chevron, valueSmall = true }: {
  label: ReactNode;
  sub?: ReactNode;
  value?: ReactNode;
  href?: string;
  external?: boolean;
  chevron?: boolean;
  valueSmall?: boolean;
}) {
  const body = (
    <>
      <span className={s.rl}><b>{label}</b>{sub ? <span>{sub}</span> : null}</span>
      {value !== undefined ? <span className={cx(s.rv, valueSmall && s.rvs, "mj-num")}>{value}</span> : null}
      {href ? <Icon name={external ? "external" : "chevron-right"} size={18} className={s.chev} /> : chevron ? <Icon name="chevron-right" size={18} className={s.chev} /> : null}
      {href && external ? <span className="mj-sr">(새 창)</span> : null}
    </>
  );
  return (
    <li className={s.rowLi}>
      {href ? (
        external ? <a className={cx(s.row, s.link)} href={href} target="_blank" rel="noopener noreferrer">{body}</a>
          : <Link className={cx(s.row, s.link)} href={href}>{body}</Link>
      ) : <div className={s.row}>{body}</div>}
    </li>
  );
}

/** 사진 칸: 폰 3열 · 웹 4~6열. 사진 위 글은 흰 바탕 이름표로(사진에 바로 글자를 얹지 않아요) */
export function Pics({ items, label }: { items: { key: string; label?: string; src?: string; alt?: string; action?: ReactNode }[]; label: string }) {
  if (!items.length) return null;
  return (
    <ul className={s.pics} aria-label={label}>
      {items.map((p) => (
        <li key={p.key} className={s.pic}>
          {p.src ? <img src={p.src} alt={p.alt ?? p.label ?? ""} loading="lazy" /> : <span className={s.ph} role="img" aria-label={p.alt ?? p.label ?? "사진"}><Icon name="image" size={22} /></span>}
          {p.label ? <span className={s.pl} aria-hidden={p.alt ? true : undefined}>{p.label}</span> : null}
          {p.action}
        </li>
      ))}
    </ul>
  );
}

/** 인용(관리자가 남긴 말 · 신고된 메시지). 글은 데이터로만 보여요 */
export function Quote({ children }: { children: ReactNode }) {
  return <p className={s.quote}>{children}</p>;
}

/** 첫 묶음(V02 · V14 · V22): 배지 + 큰 제목(20/800) + 설명 */
export function Hero({ badge, title, sub, children }: { badge?: ReactNode; title: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  return (
    <Group as="div" className={s.hero}>
      {badge}
      <h1 className={s.ht}>{title}</h1>
      {sub ? <p className={s.hs}>{sub}</p> : null}
      {children}
    </Group>
  );
}

/** 화면 맨 위 요약 한 줄(9판 k-row1): 굵은 이름 + 아래 설명 */
export function Lead({ title, sub, badge }: { title: ReactNode; sub?: ReactNode; badge?: ReactNode }) {
  return (
    <div className={s.lead}>
      <p className={s.lt}><b>{title}</b>{badge}</p>
      {sub ? <p className={cx(s.ls, "mj-num")}>{sub}</p> : null}
    </div>
  );
}

/** 웹에서 [본문 | 오른쪽 칸] 두 단(≥1024). 폰 · 태블릿은 한 줄로 쌓여요(오른쪽 칸이 아래) */
export function TwoCol({ main, side, sideLabel, sideWebOnly }: { main: ReactNode; side: ReactNode; sideLabel: string; /** 오른쪽 칸을 웹(≥1024)에서만 보여요(폰은 본문이 같은 내용을 가져요) */ sideWebOnly?: boolean }) {
  return (
    <div className={s.two}>
      <div className={s.twoMain}>{main}</div>
      <aside className={cx(s.twoSide, sideWebOnly && s.sideWeb)} aria-label={sideLabel}>{side}</aside>
    </div>
  );
}

/** 폰 · 태블릿(< 1024)에서만 · 웹(≥ 1024)에서만 보이는 칸 */
export function PhoneOnly({ children }: { children: ReactNode }) {
  return <div className={s.phoneOnly}>{children}</div>;
}
export function WebOnly({ children }: { children: ReactNode }) {
  return <div className={s.webOnly}>{children}</div>;
}
