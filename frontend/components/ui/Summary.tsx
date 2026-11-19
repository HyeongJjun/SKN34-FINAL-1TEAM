// 요약 칸(design-system 3.3 SummaryRows · KeyValue · 9판 k-row · k-kv). 화면 읽기에는 이름 · 값 목록(dl)으로 읽혀요.
//   SummaryRows: 왼쪽 이름(+ 아래 작은 글) · 오른쪽 값 — 확인 창(C34 C61) · 요청 보기(C15 C17) · 작업함 옆 자세히(D04) · 관리자(A01~A04) · 옆 칸
//   KeyValue: 칸 위 작은 이름 + 아래 값 격자(폰 2열 · 웹 cols열) — 기간 답하기(D14) · 공정표(D19)
// 값은 API · 계산 엔진 값을 lib/format.ts로 모양만 바꿔 넘겨요.
import type { ReactNode } from "react";
import s from "./Summary.module.css";

export type SummaryItem = {
  key?: string;
  label: ReactNode;
  /** 이름 아래 작은 글('실크' · '고객이 넣었어요') */
  sub?: ReactNode;
  value: ReactNode;
  /** 합계 줄(굵게 · 위 줄) */
  strong?: boolean;
  /** 흐린 값(없음 · 지남) */
  mute?: boolean;
  /** 숫자 · 금액 · 날짜(고정폭) */
  num?: boolean;
};

export function SummaryRows({ items, size = "md", className }: { items: SummaryItem[]; /** sm: 옆 칸 · 표 옆 자세히(줄 44 · 값 14) */ size?: "md" | "sm"; className?: string }) {
  return (
    <dl className={[s.rows, s[size], className].filter(Boolean).join(" ")}>
      {items.map((it, i) => (
        <div key={it.key ?? i} className={[s.row, it.strong ? s.strong : null, it.mute ? s.mute : null].filter(Boolean).join(" ")}>
          <dt className={s.l}>
            <span>{it.label}</span>
            {it.sub ? <span className={s.sub}>{it.sub}</span> : null}
          </dt>
          <dd className={[s.v, it.num ? s.num : null].filter(Boolean).join(" ")}>{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function KeyValue({ items, cols = 4, className }: { items: { key?: string; label: ReactNode; value: ReactNode; num?: boolean }[]; /** 웹(≥ 768) 열 수 */ cols?: 2 | 3 | 4; className?: string }) {
  return (
    <dl className={[s.kv, s[`c${cols}`], className].filter(Boolean).join(" ")}>
      {items.map((it, i) => (
        <div key={it.key ?? i}>
          <dt>{it.label}</dt>
          <dd className={it.num ? s.num : undefined}>{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}
