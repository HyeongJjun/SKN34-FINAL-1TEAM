// 접어 두는 목록(design-system 3.8 Accordion · 9판 k-acc · C54 자주 묻는 질문): <details> · 질문 줄 48 · 답은 옅은 회색 칸.
// 스크립트 없이 열리고 닫혀요(서버 화면 그대로). name을 주면 같은 묶음에서 하나만 펼쳐져요(브라우저 기능).
import type { ReactNode } from "react";
import { Icon } from "./Icon";
import s from "./Accordion.module.css";

export type AccordionItem = { key: string; q: ReactNode; a: ReactNode; open?: boolean };

export function Accordion({ items, name, className }: { items: AccordionItem[]; /** 하나만 펼치기 */ name?: string; className?: string }) {
  return (
    <div className={[s.list, className].filter(Boolean).join(" ")}>
      {items.map((it) => (
        <details key={it.key} id={it.key} name={name} open={it.open} className={s.item}>
          <summary className={s.q}>
            <span>{it.q}</span>
            <Icon name="chevron-down" size={20} className={s.chev} />
          </summary>
          <div className={s.a}>{it.a}</div>
        </details>
      ))}
    </div>
  );
}
