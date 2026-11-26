"use client";
// 위쪽 공사 띠(W1 A · 9판 w-band). 웹 ≥1024: 공사 이름 · 6단계(+ 실측 뒤 작은 단계) · 지금 할 일.
// 768~1023: 한 줄(공사 이름 · 지금 단계 · 지금 할 일). 폰: 숨겨요(머리 제목 + 화면 안 Steps가 대신).
// 할 일 · 기다림이 둘 이상이면 상자 전체가 '지금 할 일 n · 기다림 n ▾' 펼침 단추가 돼요(업체별 할 일 · 기다림, 작은 메뉴 모양).
// 하나면 상자 전체가 그 할 일로 가는 링크예요. 누를 곳은 모두 40px 이상(단계 칸 · 작은 단계 알약 · 할 일 상자).
// 머리(AppHeader) 바로 아래, 다른 칸으로 감싸지 않게 둬요(붙는 띠라서). 단계 이름 · 할 일 글은 부르는 쪽이 9판 말로 넘겨요.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { PROJECT_STEPS, type StepItem } from "@/components/ui/Steps";
import s from "./band.module.css";

export type BandTask = {
  /** '마루와벽 날짜 고르기' · '결도배 답 기다림' */
  label: string;
  href?: string;
  /** '11.19(목) 21:40까지'(format.dueText 값) */
  due?: string;
};

export function ProjectBand({ name, href, steps = PROJECT_STEPS, current, sub, todo = [], waiting = [], sticky = true }: {
  /** 공사 이름 '상계동 아파트 도배' */
  name: string;
  /** 한 공사 화면 */
  href: string;
  steps?: StepItem[];
  /** 지금 단계(0부터) */
  current: number;
  /** 실측 뒤 작은 단계(견적서 비교 · 업체 확정 · 공사 날짜 · 공사 · 끝 확인) */
  sub?: { steps: StepItem[]; current: number };
  todo?: BandTask[];
  waiting?: BandTask[];
  /** 붙는 띠(기본). false면 붙지 않고 위 띠 높이(--mj-band-h)에도 들어가지 않아요(예시 · 미리 보기용) */
  sticky?: boolean;
}) {
  const [open, setOpen] = useState(false);
  // 재재 화면에서는 이미 재재와 대화 중이라 링크를 숨겨요(정석 피드백 9)
  const onChat = usePathname()?.endsWith("/assistant") ?? false;
  const box = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const id = useId();
  const many = todo.length + waiting.length > 1;
  const first = todo[0] ?? waiting[0];

  useEffect(() => {
    if (!open) return;
    box.current?.querySelector<HTMLElement>(`#${CSS.escape(`${id}-todo`)} a`)?.focus();
    const onDown = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); btn.current?.focus(); } };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open, id]);

  const nowLabel = steps[current]?.label ?? "";
  const subNow = sub ? sub.steps[sub.current]?.label : null;
  const head = many ? `지금 할 일 ${todo.length}${waiting.length ? ` · 기다림 ${waiting.length}` : ""}` : todo.length ? "지금 할 일" : "기다림";
  return (
    <div className={sticky ? s.band : `${s.band} ${s.flat}`} data-mj-band={sticky ? "" : undefined} data-sub={sticky && sub ? "" : undefined}>
      <div className={s.in}>
        <div className={s.pjBox}>
          <Link className={s.pj} href={href}><b>{name}</b></Link>
          {onChat ? null : <Link className={s.chat} href={`${href}/assistant`}>재재와 대화 ›</Link>}
          <p className={s.short}><span className="mj-num">지금 {current + 1}/{steps.length}</span> · {subNow ?? nowLabel}</p>
        </div>
        <div className={s.stp}>
          <ol className={s.steps} aria-label="공사 단계">
            {steps.map((st, i) => {
              const state = i < current ? s.done : i === current ? s.now : "";
              return (
                <li key={st.label} className={state} aria-current={i === current ? "step" : undefined}>
                  {st.href && i <= current
                    ? <Link href={st.href} className={s.cell}><span className={s.label}>{st.label}</span></Link>
                    : <span className={s.cell}><span className={s.label}>{st.label}</span></span>}
                  {i < current ? <span className="mj-sr"> 끝남</span> : null}
                </li>
              );
            })}
          </ol>
          {sub ? (
            <ol className={s.subs} aria-label="실측 뒤 단계">
              {sub.steps.map((st, i) => (
                <li key={st.label} className={i < sub.current ? s.done : i === sub.current ? s.now : ""} aria-current={i === sub.current ? "step" : undefined}>
                  {i < sub.current ? <Icon name="check" size={12} strokeWidth={3} /> : null}
                  {st.href && i <= sub.current ? <Link href={st.href}>{st.label}</Link> : <span>{st.label}</span>}
                  {i < sub.current ? <span className="mj-sr"> 끝남</span> : null}
                </li>
              ))}
            </ol>
          ) : null}
        </div>
        {first ? (
          <div ref={box} className={s.todoWrap}>
            {many ? (
              <button ref={btn} type="button" className={s.todo} aria-expanded={open} aria-controls={`${id}-todo`} onClick={() => setOpen((v) => !v)}>
                <small>{head}<Icon name="chevron-down" size={14} className={s.chev} /></small>
                <span className={s.main}>{first.label}</span>
              </button>
            ) : first.href ? (
              <Link className={s.todo} href={first.href}>
                <small>{head}</small>
                <span className={s.main}>{first.label}<Icon name="chevron-right" size={16} /></span>
              </Link>
            ) : (
              <div className={s.todo}>
                <small>{head}</small>
                <span className={s.main}>{first.label}{first.due ? <span className="mj-num"> · {first.due}</span> : null}</span>
              </div>
            )}
            {many && open ? (
              <ul id={`${id}-todo`} className={s.pop}>
                {todo.map((t) => <li key={t.label}><Task t={t} kind="할 일" close={() => setOpen(false)} /></li>)}
                {waiting.map((t) => <li key={t.label}><Task t={t} kind="기다림" close={() => setOpen(false)} /></li>)}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Task({ t, kind, close }: { t: BandTask; kind: "할 일" | "기다림"; close: () => void }) {
  const body = (
    <>
      <span className={s.pl}>{t.label}{t.due ? <span className="mj-num"> · {t.due}</span> : null}</span>
      <small className={kind === "기다림" ? s.wait : s.now2}>{kind}</small>
    </>
  );
  return t.href ? <Link className={s.pi} href={t.href} onClick={close}>{body}</Link> : <span className={s.pi}>{body}</span>;
}
