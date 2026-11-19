"use client";
// 탭(design-system 3.1 Tabs · FilterPills · 9판 k-utabs · k-pills · k-pills.t). 모양 셋:
//   line  밑줄 탭 44px · 16/600, 지금 탭은 2px 진한 줄 + 굵게(C11 D07 가견적 · 사례 · 리뷰 / C43 요약 · 기록 / V15 기본 · 사례 · 링크)
//   pill  거르기 알약 40px · 14/600, 지금은 진한 바탕 흰 글자 · 상태 아이콘 붙음(작업함 V03 D04 · 관리자 상태 A02)
//   type  종류 알약, 지금은 파랑 옅은 바탕 + 1.5px 파랑 테두리(관리자 종류 A02)
// 쓰는 법 둘:
//   주소 탭: 칸마다 href(서버 화면이 ?tab= 을 읽어요) → <nav> 안 링크, 지금 칸 aria-current="page"
//   이 화면 안 탭: onChange + id → role="tablist" · ←/→ · Home · End로 옮기며 바로 바꿔요. 내용은 <TabPanel>로 감싸요
// 넘치면 줄을 바꾸지 않고 옆으로 넘겨요(폰). 지금 칸이 처음부터 보이게 옆으로만 맞춰 둬요(세로로는 움직이지 않아요).
import Link from "next/link";
import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import type { StateTone } from "@/lib/labels";
import { Icon } from "./Icon";
import { STATE_ICON } from "./StateTag";
import s from "./Tabs.module.css";

export type TabOption = {
  key: string;
  label: ReactNode;
  /** 주소 탭: 이 칸으로 가는 주소(예: "/vendor?tab=todo") */
  href?: string;
  /** 칸 이름 뒤 수(할 일 3). 0도 보이고 null · 없음이면 숨겨요 */
  count?: number | null;
  /** 상태 아이콘(N4 C) — pill에서 써요 */
  tone?: StateTone;
  disabled?: boolean;
};

export const tabId = (id: string, key: string) => `${id}-tab-${key}`;
export const panelId = (id: string, key: string) => `${id}-panel-${key}`;

export function Tabs({ label, items, value, onChange, id, variant = "line", fill, className }: {
  /** 묶음 이름(읽기용): '작업함 탭' · '처리 상태' · '신고 종류' */
  label: string;
  items: TabOption[];
  /** 지금 칸 key */
  value: string;
  /** 이 화면 안 탭이면 바꾸는 함수(+ id). 없으면 주소 탭 */
  onChange?: (key: string) => void;
  /** 이 화면 안 탭: TabPanel과 같은 값 */
  id?: string;
  variant?: "line" | "pill" | "type";
  /** line: 폰에서 칸을 같은 너비로 채워요(두세 칸일 때) */
  fill?: boolean;
  className?: string;
}) {
  const auto = useId();
  const base = id ?? auto;
  const list = useRef<HTMLDivElement & HTMLUListElement>(null);

  // 넘치는 알약 줄에서 지금 칸이 안 보이면 옆으로만 맞춰요
  useEffect(() => {
    const box = list.current;
    const on = box?.querySelector<HTMLElement>('[aria-current="page"], [aria-selected="true"]');
    if (!box || !on || box.scrollWidth <= box.clientWidth) return;
    const l = on.offsetLeft; // .list가 position: relative라 줄 안 위치예요
    if (l < box.scrollLeft || l + on.offsetWidth > box.scrollLeft + box.clientWidth) box.scrollLeft = Math.max(0, l - 16);
  }, [value]);

  const cls = [s.tabs, s[variant], fill ? s.fill : null, className].filter(Boolean).join(" ");
  const inner = (t: TabOption) => (
    <>
      {t.tone ? <Icon name={STATE_ICON[t.tone]} size={14} strokeWidth={t.tone === "ok" ? 3.2 : 3} className={`${s.ic} ${s[t.tone]}`} /> : null}
      <span>{t.label}</span>
      {t.count != null ? <span className={s.n}>{t.count}</span> : null}
    </>
  );

  if (!onChange) {
    return (
      <nav aria-label={label} className={cls}>
        <ul ref={list} className={s.list}>
          {items.map((t) => (
            <li key={t.key}>
              {t.disabled || !t.href ? (
                <span className={`${s.tab} ${s.off}`} aria-disabled="true">{inner(t)}</span>
              ) : (
                <Link href={t.href} scroll={false} className={s.tab} aria-current={t.key === value ? "page" : undefined}>{inner(t)}</Link>
              )}
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  const usable = items.filter((t) => !t.disabled);
  const move = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = usable.findIndex((t) => t.key === value);
    let next: TabOption | undefined;
    if (e.key === "ArrowRight") next = usable[(i + 1) % usable.length];
    else if (e.key === "ArrowLeft") next = usable[(i - 1 + usable.length) % usable.length];
    else if (e.key === "Home") next = usable[0];
    else if (e.key === "End") next = usable[usable.length - 1];
    if (!next) return;
    e.preventDefault();
    onChange(next.key);
    document.getElementById(tabId(base, next.key))?.focus();
  };
  return (
    <div className={cls}>
      <div ref={list} role="tablist" aria-label={label} className={s.list} onKeyDown={move}>
        {items.map((t) => {
          const on = t.key === value;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={tabId(base, t.key)}
              aria-selected={on}
              aria-controls={panelId(base, t.key)}
              tabIndex={on ? 0 : -1}
              disabled={t.disabled}
              className={`${s.tab} ${t.disabled ? s.off : ""}`}
              onClick={() => onChange(t.key)}
            >
              {inner(t)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** 이 화면 안 탭의 내용. 지금 칸만 보이고 나머지는 hidden(그려 두기만 해요) */
export function TabPanel({ tabsId, tabKey, active, children, className }: { tabsId: string; tabKey: string; active: boolean; children: ReactNode; className?: string }) {
  return (
    <div role="tabpanel" id={panelId(tabsId, tabKey)} aria-labelledby={tabId(tabsId, tabKey)} hidden={!active} tabIndex={0} className={[s.panel, className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}
