// 상태 칩(N4 C): 작은 아이콘 + 글자. 색은 아이콘에만 쓰고 글자는 진한 회색이에요(Carbon · KRDS: 색만으로 알리지 않음).
// ● 할 일 · ○ 기다림 · ✓ 일정 · 확정 · – 끝남 · ! 기한 지남. 말은 lib/labels.ts의 visitState()에서 가져와요.
import type { StateTone } from "@/lib/labels";
import { Icon, type IconName } from "./Icon";
import s from "./StateTag.module.css";

export const STATE_ICON: Record<StateTone, IconName> = { todo: "dot-todo", wait: "ring-wait", ok: "check", done: "dash-done", late: "alert-late" };
export const STATE_WORD: Record<StateTone, string> = { todo: "할 일", wait: "기다림", ok: "일정 · 확정", done: "끝남", late: "기한 지남" };

export function StateTag({ tone, children, className }: { tone: StateTone; children: React.ReactNode; className?: string }) {
  return (
    <span className={[s.tag, s[tone], className].filter(Boolean).join(" ")}>
      <Icon name={STATE_ICON[tone]} size={14} strokeWidth={tone === "ok" ? 3.2 : 3} className={s.ic} />
      {children}
    </span>
  );
}

/** 범례(작업함 아래 한 줄). 화면 읽기에는 목록으로 읽혀요 */
export function StateLegend({ tones = ["todo", "wait", "ok", "done", "late"] }: { tones?: StateTone[] }) {
  return (
    <ul className={s.legend} aria-label="상태 표시">
      {tones.map((t) => <li key={t}><StateTag tone={t}>{STATE_WORD[t]}</StateTag></li>)}
    </ul>
  );
}
