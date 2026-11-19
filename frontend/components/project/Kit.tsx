// B2b 화면(실측 일정 · 채팅 · 실측 뒤 · 내 공사 · 알림 · 계정)이 같이 쓰는 작은 조각. 서버 화면에서 그대로 써요.
// 9판 k-g(묶음) · k-row(줄) · k-row1(흰 띠) · k-info(안내 상자) · k-quote · k-meta · k-av · k-file · k-utabs · k-chips를 토큰으로 옮겼어요.
// 안내 상자 · 얼굴 · 파일 줄 · 탭 · 사진 칸은 B4 조각(ui-components 3.23~3.35)을 그대로 불러요(이 파일은 이름만 이어 줘요).
import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar as UiAvatar } from "@/components/ui/Avatar";
import { FileRow as UiFileRow } from "@/components/ui/FileRow";
import { Icon } from "@/components/ui/Icon";
import { Notice as UiNotice } from "@/components/ui/Notice";
import { PhotoGrid } from "@/components/ui/PhotoGrid";
import { Tabs as UiTabs } from "@/components/ui/Tabs";
import { fileSize } from "@/lib/format";
import s from "./kit.module.css";

const cx = (...v: (string | false | null | undefined)[]) => v.filter(Boolean).join(" ");

/** 묶음(흰 칸). hi: 할 일 있는 카드(파랑 2px) · warn: 제안 온 카드(주황 2px) · list: 줄 목록 */
export function Group({ children, hi, warn, list, as: Tag = "section", className, label }: { children: ReactNode; hi?: boolean; warn?: boolean; list?: boolean; as?: "section" | "div" | "li" | "article"; className?: string; label?: string }) {
  return <Tag className={cx(s.group, list && s.list, hi && s.hi, warn && s.hiWarn, className)} aria-label={label}>{children}</Tag>;
}
export function GroupHead({ children }: { children: ReactNode }) { return <div className={s.head}>{children}</div>; }
export function Name({ children, as: Tag = "h2" }: { children: ReactNode; as?: "h2" | "h3" | "b" }) { return <Tag className={s.name}>{children}</Tag>; }
export function Eyebrow({ children, pad, as: Tag = "p" }: { children: ReactNode; pad?: boolean; as?: "p" | "h2" | "h3" }) { return <Tag className={cx(s.eyebrow, pad && s.eyebrowPad)}>{children}</Tag>; }
export function Sub({ children }: { children: ReactNode }) { return <p className={s.sub}>{children}</p>; }
export function Small({ children, id }: { children: ReactNode; id?: string }) { return <p id={id} className={s.small}>{children}</p>; }
export function Title({ children, as: Tag = "p", id }: { children: ReactNode; as?: "p" | "h2" | "h3"; id?: string }) { return <Tag id={id} className={s.title}>{children}</Tag>; }
export function Quote({ children }: { children: ReactNode }) { return <p className={s.quote}>{children}</p>; }
export function Meta({ children }: { children: ReactNode }) { return <p className={s.meta}>{children}</p>; }
/** 단추 줄(1:1) */
export function Btns({ children }: { children: ReactNode }) { return <div className={s.btns}>{children}</div>; }

/** 줄 목록 */
export function Rows({ children, label }: { children: ReactNode; label?: string }) {
  return <div className={s.rows} role={label ? "list" : undefined} aria-label={label}>{children}</div>;
}
/** 줄 하나: 이름(+ 아래 작은 글) | 값. href면 줄 전체가 링크(›) · out: 흐린 줄 · total: 합계 줄 */
export function Row({ label, sub, value, valueSub, href, out, total, lead, list }: {
  label: ReactNode;
  sub?: ReactNode;
  value?: ReactNode;
  /** 값을 작은 회색 글로 */
  valueSub?: boolean;
  href?: string;
  out?: boolean;
  total?: boolean;
  lead?: ReactNode;
  /** 줄 목록(Rows label)이 있을 때 listitem으로 읽혀요 */
  list?: boolean;
}) {
  const body = (
    <>
      {lead}
      <span className={s.rowText}>
        <span className={s.rowLabel}>{label}</span>
        {sub ? <span className={s.rowSub}>{sub}</span> : null}
      </span>
      {value != null ? <span className={cx(s.rowValue, valueSub && s.rowValueSub, "mj-num")}>{value}</span> : null}
      {href ? <Icon name="chevron-right" size={18} className={s.chev} /> : null}
    </>
  );
  const cls = cx(s.row, out && s.rowOut, total && s.rowTotal);
  const role = list ? "listitem" : undefined;
  if (href) return <Link className={cls} href={href} role={role}>{body}</Link>;
  return <div className={cls} role={role}>{body}</div>;
}

/** 흰 띠 한 줄(요청 머리 · 담은 업체 수 · 기본 정보 잠김): 왼쪽 글 + 오른쪽 단추 */
export function Strip({ label, sub, action, href }: { label: ReactNode; sub?: ReactNode; action?: ReactNode; href?: string }) {
  const text = (
    <span className={s.rowText}>
      <span className={s.rowLabel}>{label}</span>
      {sub ? <span className={s.rowSub}>{sub}</span> : null}
    </span>
  );
  if (href) return <Link className={s.strip} href={href}>{text}<Icon name="chevron-right" size={18} className={s.chev} /></Link>;
  return <div className={s.strip}>{text}{action}</div>;
}

export type NoticeTone = "blue" | "gray" | "sub" | "warn";
const NOTICE_TONE = { blue: "info", gray: "white", sub: "gray", warn: "warn" } as const;
/** 안내 상자(B4 Notice). blue 정보 · gray 흰 칸 · sub 옅은 회색 · warn 주의 */
export function Notice({ children, tone = "blue", role }: { children: ReactNode; tone?: NoticeTone; role?: "status" | "note" }) {
  const box = <UiNotice tone={NOTICE_TONE[tone]}>{children}</UiNotice>;
  return role ? <div role={role}>{box}</div> : box;
}

/** 업체 · 고객 얼굴: 이름 첫 글자(B4 Avatar, 이름은 옆 글이 읽혀요) */
export function Avatar({ name, small }: { name: string; small?: boolean }) {
  return <UiAvatar name={name} size={small ? "s" : "m"} />;
}

/** 파일 줄(B4 FileRow): 형식 · 이름 · 크기 + 열기 ↗(새 창) */
/** 크기 앞 종류 말(9판 C33 '엑셀 · 38KB' · 'PDF · 412KB' · '사진 · …') */
const kindWord = (type: string) => (type === "application/pdf" ? "PDF" : /sheet|excel|csv/.test(type) ? "엑셀" : type.startsWith("image/") ? "사진" : null);

export function FileRow({ name, type, size, href }: { name: string; type: string; size: number; href: string }) {
  const kind = kindWord(type);
  return <UiFileRow name={name} size={kind ? `${kind} · ${fileSize(size)}` : size} href={href} />;
}

/** 주소 탭(요약 · 기록, B4 Tabs line). 다른 주소로 가는 링크예요 */
export function Tabs({ items, label }: { items: { label: string; href: string; on: boolean }[]; label: string }) {
  const on = items.find((t) => t.on)?.href ?? items[0]?.href ?? "";
  return <UiTabs label={label} value={on} items={items.map((t) => ({ key: t.href, label: t.label, href: t.href }))} />;
}

/** 보이기만 하는 칩 목록. tone on: 포함 · warn: 따로 · 안 적음 */
export function InfoChips({ items, label }: { items: { text: string; spoken: string; tone?: "on" | "warn" }[]; label: string }) {
  return (
    <ul className={s.chips} aria-label={label}>
      {items.map((c) => (
        <li key={c.text} className={cx(s.chip, c.tone === "on" && s.chipOn, c.tone === "warn" && s.chipWarn)}>
          {c.tone === "on" ? <Icon name="check" size={14} strokeWidth={3} /> : null}
          <span aria-hidden="true">{c.text}</span>
          <span className="mj-sr">{c.spoken}</span>
        </li>
      ))}
    </ul>
  );
}

/** 사진 칸(B4 PhotoGrid). src는 같은 주소 API 경로만 넘겨요 */
export function Pics({ items, label }: { items: { src: string; alt: string; tag?: string }[]; label: string }) {
  if (!items.length) return null;
  return <PhotoGrid label={label} photos={items.map((p) => ({ key: p.src, src: p.src, alt: p.alt, label: p.tag }))} />;
}
