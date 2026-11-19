"use client";
// 별점(design-system 3.2 Stars).
// - 보여 주기: '★ 4.8 (5)' — 숫자가 주인공이고 별은 꾸밈. 읽는 글은 '별점 4.8, 리뷰 5개'(CF-71).
// - 고르기(리뷰 쓰기 C39): 별 5개 단추 44×44(radiogroup, 화살표 키로 옮겨요). 고른 별 #c48200(3.21:1), 안 고른 별 회색 테두리. 읽는 글 '5점 만점에 4점'.
import { useRef, type KeyboardEvent } from "react";
import { Icon } from "./Icon";
import s from "./Stars.module.css";

export function Stars({ value, count, size = "md" }: { value: number; count?: number; size?: "sm" | "md" }) {
  const v = value.toFixed(1);
  return (
    <span className={`${s.show} ${size === "sm" ? s.sm : ""}`}>
      <span aria-hidden="true" className={s.showStar}><Icon name="star" size={size === "sm" ? 13 : 16} filled strokeWidth={1.5} /></span>
      <span aria-hidden="true" className="mj-num">{v}{count != null ? ` (${count})` : ""}</span>
      <span className="mj-sr">별점 {v}{count != null ? `, 리뷰 ${count}개` : ""}</span>
    </span>
  );
}

export function StarInput({ value, onChange, label = "별점" }: { value: number; onChange: (v: number) => void; label?: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (e: KeyboardEvent, i: number) => {
    const next = e.key === "ArrowRight" || e.key === "ArrowUp" ? Math.min(5, i + 1) : e.key === "ArrowLeft" || e.key === "ArrowDown" ? Math.max(1, i - 1) : null;
    if (next == null) return;
    e.preventDefault();
    onChange(next);
    refs.current[next - 1]?.focus();
  };
  return (
    <div className={s.input} role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          ref={(el) => { refs.current[n - 1] = el; }}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`5점 만점에 ${n}점`}
          tabIndex={value === n || (value === 0 && n === 1) ? 0 : -1}
          className={n <= value ? `${s.star} ${s.on}` : s.star}
          onClick={() => onChange(n)}
          onKeyDown={(e) => move(e, n)}
        >
          <Icon name="star" size={32} filled={n <= value} strokeWidth={1.6} />
        </button>
      ))}
    </div>
  );
}
