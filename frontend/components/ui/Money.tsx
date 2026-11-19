// 금액(design-system 3.3 BigFigure · Money). 금액은 계산 엔진이 준 원 단위 정수만 받아 모양만 바꿔요.
// - 카드 · 제목 · 문장: 만 단위 '197만 4,069원'(won) · 견적서 줄 · 합계 칸: 전체 자리 '1,974,069원'(wonFull)
// - 고객이 보는 금액은 부가세 포함이고, 큰 숫자 옆에는 늘 '부가세 포함'을 붙여요(copy-guide F1-2).
// - 화면마다 큰 숫자는 하나만(28 · 웹 38). 둘이면 하나를 중간(20)으로 내려요.
import type { ReactNode } from "react";
import { won, wonDelta, wonFull } from "@/lib/format";
import { Badge } from "./Badge";
import s from "./Money.module.css";

export type MoneySize = "big" | "mid" | "line" | "text";

/** 금액 글자. full: 전체 자리 · delta: '+5만 5,000원' · paren: 합계 밖 '(299,635원)' · null이면 empty 글 */
export function Money({ value, size = "text", full, delta, paren, empty = "가견적 준비 중", className }: {
  value: number | null | undefined;
  size?: MoneySize;
  full?: boolean;
  delta?: boolean;
  paren?: boolean;
  empty?: string;
  className?: string;
}) {
  const cls = [s.money, s[size], paren ? s.out : null, "mj-num", className].filter(Boolean).join(" ");
  if (value == null) return <span className={[s.none, size === "big" || size === "mid" ? s.noneBig : null, className].filter(Boolean).join(" ")}>{empty}</span>;
  const text = delta ? wonDelta(value) : full ? wonFull(value) : won(value);
  return <span className={cls}>{paren ? `(${text})` : text}</span>;
}

/**
 * 큰 숫자 묶음: 금액 · 날짜 · 기간 · 별점 하나를 크게 + 아래 한 줄.
 * caption 기본은 금액이면 '부가세 포함'. past면 글자를 회색으로 + '지났어요' 배지(투명도는 안 써요).
 */
export function BigFigure({ value, children, size = "big", caption, sub, past, label }: {
  /** 금액(원). 날짜 · 기간은 children으로 글을 넘겨요(예: '12월 15일(화) 오전') */
  value?: number | null;
  children?: ReactNode;
  size?: "big" | "mid";
  /** 큰 숫자 바로 아래 줄. 금액이면 기본 '부가세 포함' */
  caption?: ReactNode;
  /** 그 아래 옅은 줄(예: '예산 300만 원 안이에요') */
  sub?: ReactNode;
  past?: boolean;
  /** 큰 숫자 위 작은 이름(예: '희망 기간') */
  label?: ReactNode;
}) {
  const isMoney = value !== undefined;
  const cap = caption ?? (isMoney && value !== null ? "부가세 포함" : null);
  return (
    <div className={[s.fig, past ? s.past : null].filter(Boolean).join(" ")}>
      {label ? <p className={s.label}>{label}</p> : null}
      <p className={s.figRow}>
        {isMoney ? <Money value={value} size={size} /> : <span className={`${s.money} ${s[size]} mj-num`}>{children}</span>}
        {past ? <Badge tone="mute">지났어요</Badge> : null}
      </p>
      {cap ? <p className={s.cap}>{cap}</p> : null}
      {sub ? <p className={s.sub}>{sub}</p> : null}
    </div>
  );
}
