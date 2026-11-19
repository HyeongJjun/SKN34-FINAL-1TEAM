"use client";
// 업체 카드(design-system 3.4 VendorRow · 9판 k-v): 얼굴 · 이름 · 가견적(20/800) · 견줌 줄 · 별점 · 공사 수.
// 이름 · 금액 쪽은 업체 자세히로 가는 링크, '담기'는 따로 단추예요(링크 안에 단추를 넣지 않아요). 담기 40px.
// 상태: add 담기 · added 담음(눌림) · full 3곳 다 참 · preparing 가견적 준비 중(D06) · excluded 이 벽지는 안 해요(D07).
import Link from "next/link";
import { useId, type ReactNode } from "react";
import { Money } from "./Money";
import { Icon } from "./Icon";
import { Stars } from "./Stars";
import s from "./VendorCard.module.css";

export type ShortlistState = "add" | "added" | "full" | "preparing" | "excluded";

export function VendorCard({ name, href, amount, compare, place, badge, rating, jobs, extra, state, onToggle, busy }: {
  name: string;
  href: string;
  /** 가견적(부가세 포함, 계산 엔진 값). 없으면 '가견적 준비 중' */
  amount: number | null;
  /** '표준견적서보다 41% 많아요'(계산 엔진 값으로 만든 글). 가견적이 있을 때만 보여요 */
  compare?: string;
  /** 가까운 구 카드의 구 이름(9판 C12 · CF-30). 견줌 줄 자리에 가견적 · 상태와 상관없이 보여요 */
  place?: string;
  /** 이름 옆 배지(예: <Badge tone="ok">바로 확정</Badge>) */
  badge?: ReactNode;
  rating?: { avg: number; count: number };
  /** 믿집 공사 수 */
  jobs?: number;
  /** 줄 끝에 붙일 글(예: '실측 무료') */
  extra?: string;
  state: ShortlistState;
  onToggle?: () => void;
  busy?: boolean;
}) {
  const id = useId();
  const off = state === "preparing" || state === "excluded" || state === "full";
  const label = state === "added" ? "담음" : state === "preparing" ? "가견적 준비 중" : state === "excluded" || state === "full" ? "담을 수 없어요" : "담기";
  const meta = [jobs != null ? `믿집 공사 ${jobs}건` : null, extra].filter(Boolean).join(" · ");
  return (
    <div className={s.card}>
      <span className={s.av} aria-hidden="true">{name.slice(0, 1)}</span>
      <Link className={s.main} href={href}>
        <span id={`${id}-n`} className={s.name}>{name}{badge ? <span className={s.badge}>{badge}</span> : null}</span>
        {state === "excluded" ? <span className={s.none}>이 벽지는 안 해요</span> : <Money value={amount} size="mid" className={s.amount} />}
        {place ? <span className={s.cmp}>{place}</span> : compare && state !== "excluded" && amount != null ? <span className={s.cmp}>{compare}</span> : null}
        {rating || meta ? (
          <span className={s.meta}>
            {rating ? <Stars value={rating.avg} count={rating.count} size="sm" /> : null}
            {rating && meta ? " · " : null}{meta}
          </span>
        ) : null}
      </Link>
      <button
        type="button"
        className={`${s.pick} ${state === "added" ? s.on : ""}`}
        aria-pressed={state === "added" || state === "add" ? state === "added" : undefined}
        aria-disabled={off || busy || undefined}
        aria-describedby={`${id}-n`}
        onClick={() => { if (!off && !busy) onToggle?.(); }}
      >
        {label}{state === "added" ? <Icon name="check" size={16} strokeWidth={2.4} /> : null}
      </button>
    </div>
  );
}

/** 담기 띠(ShortlistTray): 폰 아래 붙음 · 웹 목록 아래 카드. 담은 수 · 남은 수 + 다음 단추 */
export function ShortlistTray({ count, max = 3, action, note }: { count: number; max?: number; action: ReactNode; note?: string }) {
  const left = max - count;
  return (
    <div className={s.tray} role="status">
      <div className={s.trayText}>
        <b>담은 업체 {count}곳</b>
        <span>{left > 0 ? `${left}곳 더 담을 수 있어요` : `${max}곳을 다 담았어요`}{note ? ` · ${note}` : ""}</span>
      </div>
      {action}
    </div>
  );
}
