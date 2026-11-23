"use client";
// 오른쪽 '내 도배 플랜' 8단계(시연 영상): 단계를 누르면 그 단계의 폼 · 할 일 체크 · 재재가 챙긴 일만 보여요.
// 할 일 체크는 이 기기에만 둬요(서버 체크는 공사 전 준비 체크 · PUT /projects/{id}/checks가 따로 있어요).
import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import s from "./flow.module.css";

export const PLAN_STEPS = ["집", "견적", "업체", "실측", "비교", "일정", "공사", "완료"] as const;
const TODO: Record<number, string[]> = {
  0: ["벽지를 손으로 만져 보기(실크 · 합지)", "창문 둘레 · 모서리 곰팡이 보기", "도배할 방 사진 찍어 두기"],
  1: ["표준견적서 줄을 한 번 읽어 보기", "직접 할 일(반셀프) 정하기"],
  2: ["가견적만 보지 말고 후기 · 시공 수도 보기", "전체 업체 목록도 한 번 보기"],
  3: ["실측 날 집에 있을 사람 정하기", "업체에 물어볼 것 적어 두기"],
  4: ["철거 · 폐기물이 견적서에 들어 있는지", "하자 보수 기간 보기"],
  5: ["관리사무소에 공사 신고", "엘리베이터 보양 예약"],
  6: ["가구와 짐을 벽에서 떼어 두기", "추가 금액은 사진과 이유를 먼저 받기"],
  7: ["들뜬 곳 · 이음매 · 모서리 확인", "리뷰 남기기"],
};
const KEY = (scope: string) => `mj_plan_todo_${scope}`;

export function Plan({ now, scope, open, render, auto }: {
  /** 지금 단계(0~7, 다 끝나면 8) */
  now: number;
  /** 할 일 체크를 이 기기에 둘 이름(공사 id 또는 guest) */
  scope: string;
  open: boolean;
  /** 단계별 폼 · 정보(없으면 할 일만) */
  render?: (step: number) => ReactNode;
  /** 재재가 챙긴 일(단계별) */
  auto?: Record<number, string[]>;
}) {
  const [tab, setTab] = useState(Math.min(now, 7));
  const [done, setDone] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(window.localStorage.getItem(KEY(scope)) ?? "{}"); } catch { return {}; }
  });
  const toggle = (k: string) => setDone((d) => {
    const n = { ...d, [k]: !d[k] };
    try { window.localStorage.setItem(KEY(scope), JSON.stringify(n)); } catch { /* 이 기기에 못 두면 이번 화면에서만 */ }
    return n;
  });
  const todos = TODO[tab] ?? [];
  const left = todos.filter((t) => !done[`${tab}:${t}`]).length;
  return (
    <aside className={open ? `${s.plan} ${s.planOpen}` : s.plan} aria-label="내 도배 플랜">
      <h2 className={s.planT}>내 도배 플랜 <Badge tone="mute">{Math.min(now + 1, 8)}/8 단계</Badge></h2>
      <div className={s.tabs} role="tablist" aria-label="플랜 단계">
        {PLAN_STEPS.map((label, i) => (
          <button key={label} type="button" role="tab" aria-selected={tab === i} className={[s.tab, tab === i ? s.tabOn : "", i < now ? s.tabDone : ""].join(" ")} onClick={() => setTab(i)}>
            <span className={s.dot}>{i < now ? "✓" : i + 1}</span>{label}
          </button>
        ))}
      </div>
      <div className={s.panel} role="tabpanel">
        <h3>{tab + 1}. {PLAN_STEPS[tab]} {tab === now ? <Badge tone="now">지금</Badge> : tab < now ? <Badge tone="ok">끝남</Badge> : null}</h3>
        {render ? render(tab) : null}
        {auto?.[tab]?.length ? (
          <>
            <p className={s.eb}>재재가 챙긴 일</p>
            <ul className={s.auto}>{auto[tab].map((t) => <li key={t}>✓ {t}</li>)}</ul>
          </>
        ) : null}
        {todos.length ? (
          <>
            <p className={s.eb}>내가 할 일 {left ? `· ${left}개 남음` : "· 다 했어요"}</p>
            {todos.map((t) => (
              <label key={t} className={s.todo}><input type="checkbox" checked={!!done[`${tab}:${t}`]} onChange={() => toggle(`${tab}:${t}`)} />{t}</label>
            ))}
          </>
        ) : null}
      </div>
    </aside>
  );
}
