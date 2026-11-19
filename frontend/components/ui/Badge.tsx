// 배지 · 안 읽은 수 · 기한 배지(design-system 3.6). 글자가 늘 함께라 색만으로 알리지 않아요.
import { dueState, dueText } from "@/lib/format";
import { Icon } from "./Icon";
import s from "./Badge.module.css";

export type BadgeTone = "now" | "wait" | "ok" | "bad" | "mute";

/** 배지 24px · 13/700. now 지금(파랑) · wait 기다림(주황) · ok 확정(초록) · bad 지남 · 거절(빨강) · mute 준비 중 · 닫힘(회색) */
export function Badge({ tone = "mute", children, className }: { tone?: BadgeTone; children: React.ReactNode; className?: string }) {
  return <span className={[s.badge, s[tone], className].filter(Boolean).join(" ")}>{children}</span>;
}

/** 안 읽은 수 20px. 보이는 수는 읽지 않고, 무엇의 수인지는 부르는 쪽 이름에 넣어요(예: '알림, 새 알림 3개') */
export function Count({ n, max = 99, className }: { n: number; max?: number; className?: string }) {
  if (n <= 0) return null;
  return <span className={[s.count, "mj-num", className].filter(Boolean).join(" ")} aria-hidden="true">{n > max ? `${max}+` : n}</span>;
}

/**
 * 기한 배지: '11.25(수) 09:05까지' → 가까우면(오늘 · 내일) 주황 → 지나면 '지났어요'(빨강).
 * due · now는 계산 엔진 · 서버가 준 시각(ISO)이에요. 화면은 시계를 읽지 않아요.
 * relative: 업체 폰 작업함처럼 '내일 21:40까지'로 말해요. who: '고객이 골라요'처럼 누가 하는지 뒤에 붙여요.
 */
export function DueBadge({ due, now, relative, who, overText = "지났어요" }: { due: string; now: string; relative?: boolean; who?: string; overText?: string }) {
  const st = dueState(due, now);
  const tone: BadgeTone = st === "over" ? "bad" : st === "near" ? "wait" : "mute";
  const text = st === "over" ? overText : dueText(due, { now, relative });
  return (
    <Badge tone={tone} className={s.due}>
      <Icon name={st === "over" ? "error" : "clock"} size={14} />
      <time dateTime={due} className="mj-num">{text}</time>
      {who && st !== "over" ? <span>{who}</span> : null}
    </Badge>
  );
}
