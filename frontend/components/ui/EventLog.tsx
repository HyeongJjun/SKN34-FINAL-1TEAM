// 기록(design-system 3.3 EventLog · C63 한 공사 기록 · V23 공사 한 건): 시각 13/700 · 누가 13/700 · 무엇 14. 시간 순 그대로.
// at은 서버 시각(ISO)이고 '11.21 10:12'(listStamp)로만 바꿔요. 업체가 쓴 글은 글자로만 넣어요(HTML로 넣지 않아요).
import type { ReactNode } from "react";
import { listStamp } from "@/lib/format";
import s from "./EventLog.module.css";

export type LogItem = { key: string; at: string; who: ReactNode; what: ReactNode };

export function EventLog({ items, label = "기록", className }: { items: LogItem[]; label?: string; className?: string }) {
  return (
    <ol className={[s.log, className].filter(Boolean).join(" ")} aria-label={label}>
      {items.map((it) => (
        <li key={it.key} className={s.item}>
          <span className={s.meta}>
            <time dateTime={it.at}>{listStamp(it.at)}</time>
            <b>{it.who}</b>
          </span>
          <span className={s.what}>{it.what}</span>
        </li>
      ))}
    </ol>
  );
}
