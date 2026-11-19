// 믿집 계산 상자(routes.md 3장 CalcBox · design-system CalcNote · 9판 k-calc).
// 계산 엔진이 만든 수 · 결과를 그대로 받아 '식 = 답' 한 줄로만 보여요. 이 상자는 아무것도 계산하지 않아요(copy-guide W15).
// 줄마다 terms(수와 기호)와 result를 넘기면 모양(쉼표 · 단위 · 괄호)만 맞춰요. 식과 답이 바로 이어져야 해요.
import { decText, wonFull } from "@/lib/format";
import s from "./CalcBox.module.css";

/** 수 하나. n은 API 값(정수 · 소수 문자열). unit '원'은 쉼표 꼴, 나머지는 붙여 써요 */
export type CalcTerm = { n: number | string; unit?: "원" | "㎡" | "평" | "일" | "품" | "명" | "%" | ""; paren?: boolean; label?: string };
export type CalcLine = { terms: (CalcTerm | "×" | "+" | "−" | "÷")[]; result: CalcTerm; note?: string };

export function termText(t: CalcTerm): string {
  const num = typeof t.n === "string" ? decText(t.n) : t.n.toLocaleString("ko-KR", { maximumFractionDigits: 4 });
  const body = t.unit === "원" ? wonFull(typeof t.n === "string" ? Number(t.n) : t.n) : `${num}${t.unit ?? ""}`;
  const withLabel = t.label ? `${t.label} ${body}` : body;
  return t.paren ? `(${withLabel})` : withLabel;
}

export function CalcBox({ lines, tone = "ai", title = "믿집 계산" }: {
  lines: CalcLine[];
  /** ai: AI 답 안(흰 바탕 + 테두리) · form: 양식 안(옅은 회색) */
  tone?: "ai" | "form";
  title?: string;
}) {
  return (
    <div className={`${s.box} ${tone === "form" ? s.form : ""}`}>
      <p className={s.title}>{title}</p>
      {lines.map((l, i) => (
        <p key={i} className={`${s.line} mj-num`}>
          {l.terms.map((t, j) => (typeof t === "string" ? <span key={j} className={s.op}> {t} </span> : <span key={j}>{termText(t)}</span>))}
          <span className={s.op}> = </span>
          <b>{termText(l.result)}</b>
          {l.note ? <span className={s.note}> · {l.note}</span> : null}
        </p>
      ))}
    </div>
  );
}
