"use client";
// 알림 줄(C44 · V21 · 웹 머리 펼침 D09): '[누가] [일어난 일]해요' + '[공사 이름] · 시각'.
// 안 읽은 알림은 빨간 점 + 숨은 글 '새 알림'(색만으로 알리지 않아요). 누르면 그 일로 가요.
import Link from "next/link";
import type { ReactNode } from "react";
import s from "./NotifyRow.module.css";

/** 이 사이트 안 경로만 링크로 써요(알림 link는 API 값) */
export const safeLink = (v: string | null | undefined) => (v && v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : "/notifications");

export function NotifyRow({ href, title, sub, time, unread, onOpen }: {
  href: string;
  /** 알림 글(API body) */
  title: string;
  /** 공사 이름 · 업체 이름처럼 어디의 일인지 */
  sub?: string;
  /** listStamp() 꼴 '11.21 10:12' */
  time?: string;
  unread?: boolean;
  /** 누를 때(읽음 보내기) */
  onOpen?: () => void;
}) {
  return (
    <Link className={s.row} href={safeLink(href)} onClick={onOpen}>
      <span className={unread ? `${s.dot} ${s.on}` : s.dot} aria-hidden="true" />
      <span className={s.text}>
        {unread ? <span className="mj-sr">새 알림, </span> : null}
        <b>{title}</b>
        {sub || time ? <span className={s.sub}>{[sub, time].filter(Boolean).join(" · ")}</span> : null}
      </span>
    </Link>
  );
}

/** 새 알림 · 지난 알림 묶음(C44) */
export function NotifyList({ fresh, past }: { fresh: ReactNode[]; past: ReactNode[] }) {
  return (
    <div className={s.list}>
      {fresh.length ? <><p className={s.eb}>새 알림</p><div>{fresh}</div></> : null}
      {past.length ? <><p className={`${s.eb} ${fresh.length ? s.pad : ""}`}>지난 알림</p><div>{past}</div></> : null}
    </div>
  );
}
