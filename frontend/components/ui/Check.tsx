"use client";
// 체크(design-system 3.2 Check · 9판 k-ck · k-opt): 24px · 2px 테두리 gray-500(3.5:1, 9판 1.46) · 고르면 파랑 + 흰 ✓.
// 네모 = 여럿 고르기(checkbox, 관리자 확인 칸 A01 · 동의 C05) · 둥근 = 하나 고르기(radio, 처리 고르기 A02). round로 바꿀 수 있어요.
// row: 줄 48 + 아래 옅은 줄(9판 k-opt) · 기본: 글 옆 작은 체크(누를 곳 44). 진짜 input이라 폼 · 키보드 · 화면 읽기가 그대로 돼요.
// 시트 · 창 안 '이유 고르기'(단추로 바로 고르는 줄)는 Sheet의 OptionRow를 써요.
import { forwardRef, useId, type ChangeEvent, type ReactNode } from "react";
import { Icon } from "./Icon";
import s from "./Check.module.css";

type Props = {
  label: ReactNode;
  /** 이름 아래 한 줄(13) */
  hint?: ReactNode;
  type?: "checkbox" | "radio";
  /** 모양만 둥글게(기본: radio 둥근 · checkbox 네모) */
  round?: boolean;
  /** 줄 48 + 아래 옅은 줄 */
  row?: boolean;
  /** 위험한 처리(업체 기능 멈추기 등) 글자 빨강 */
  danger?: boolean;
  name?: string;
  value?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (on: boolean, e: ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
};

export const Check = forwardRef<HTMLInputElement, Props>(function Check(
  { label, hint, type = "checkbox", round, row, danger, onChange, className, ...input },
  ref,
) {
  const id = useId();
  const isRound = round ?? type === "radio";
  return (
    <label className={[s.check, row ? s.row : null, input.disabled ? s.off : null, danger ? s.danger : null, className].filter(Boolean).join(" ")}>
      <input
        ref={ref}
        type={type}
        className={s.input}
        aria-describedby={hint ? `${id}-h` : undefined}
        onChange={(e) => onChange?.(e.target.checked, e)}
        {...input}
      />
      <span className={[s.box, isRound ? s.round : null].filter(Boolean).join(" ")} aria-hidden="true">
        <Icon name="check" size={16} strokeWidth={3.2} />
      </span>
      <span className={s.text}>
        <span className={s.label}>{label}</span>
        {hint ? <span id={`${id}-h`} className={s.hint}>{hint}</span> : null}
      </span>
    </label>
  );
});

/** 체크 묶음(fieldset + legend). 하나 고르기(radio)는 같은 name을 넘겨요 */
export function CheckGroup({ legend, hideLegend, children, className }: { legend: string; hideLegend?: boolean; children: ReactNode; className?: string }) {
  return (
    <fieldset className={[s.group, className].filter(Boolean).join(" ")}>
      <legend className={hideLegend ? "mj-sr" : s.legend}>{legend}</legend>
      {children}
    </fieldset>
  );
}
