"use client";
// 업체 작업 화면(시연 영상 업체편): 왼쪽 재재 칸(지금 할 일 한마디 · 다른 받은 일 · 말로 칸 채우기) + 오른쪽 받은 일 폼.
// 폼은 기존 화면을 그대로 써요. 폼 안의 업체 도우미 칸(AssistBox)은 AssistSlot으로 왼쪽 재재 칸에 옮겨 그려요.
// 폰(<1024)은 재재 한마디 · 도우미 칸이 폼 위에 오고, 다른 받은 일 목록은 접어 둬요.
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Jaejae } from "@/components/secretary/Jaejae";
import { AssistSlot } from "../assist/slot";
import s from "./desk.module.css";

export type DeskItem = { href: string; label: string; title: string; next: string | null; on: boolean };

export function Desk({ say, feed, children }: {
  /** 재재가 지금 할 일을 한두 줄로 */
  say: string[];
  /** 다른 받은 일(할 일 · 공사) */
  feed: DeskItem[];
  children: ReactNode;
}) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const others = feed.filter((x) => !x.on);
  return (
    <AssistSlot.Provider value={slot}>
      <div className={s.desk}>
        <aside className={s.side} aria-label="재재 업체 비서">
          <div className={s.bot}>
            <span className={s.face} aria-hidden><Jaejae size={44} /></span>
            <div className={s.bubble}>{say.map((t) => <p key={t}>{t}</p>)}</div>
          </div>
          <div ref={setSlot} className={s.slot} />
          {others.length ? (
            <details className={s.feed} open>
              <summary>다른 받은 일 {others.length}개</summary>
              <ul>
                {others.slice(0, 8).map((x) => (
                  <li key={x.href}>
                    <Link href={x.href} className={s.item}>
                      <b>{x.label}</b> {x.title}
                      {x.next ? <span>{x.next}</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          ) : <p className={s.none}>다른 받은 일은 없어요.</p>}
          <Link href="/vendor" className={s.all}>작업함 전체 보기</Link>
        </aside>
        <div className={s.work}>{children}</div>
      </div>
    </AssistSlot.Provider>
  );
}
