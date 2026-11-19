"use client";
// 입력 칸(design-system 3.2 Field · TextArea · Select). 48px · 글자 16(iOS 확대 막음) · 1px 테두리 3.5:1 · 라벨 14/600 위.
// 오류는 칸 아래에만 한 줄(사용자 결정 U5): [무엇이 문제] + [고치는 법]. 검사는 제출 때 한 번 → 첫 틀린 칸으로 초점(I6 B, 부르는 쪽).
// 칸 이름(label)은 늘 있어요(placeholder는 이름이 아니에요). 단위(㎡ · 원 · 만 원 · 일 · 평)는 칸 오른쪽 안에 붙어요.
// 웹(≥768)에서 칸은 최대 520, 숫자 칸(num)은 240까지만 넓어져요(작은 손질 5).
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Icon } from "./Icon";
import s from "./Field.module.css";

type Base = {
  label: ReactNode;
  /** 칸 아래 오류 한 줄. 있으면 aria-invalid */
  error?: string | null;
  /** 칸 아래 짧은 도움말(힌트는 최소로, U6) */
  hint?: ReactNode;
  /** 라벨 옆 작은 글(예: '선택') */
  optional?: boolean;
  /** 라벨을 숨겨요(화면 읽기에는 남아요) */
  hideLabel?: boolean;
  className?: string;
};

function Wrap({ id, base, children, wide }: { id: string; base: Base; children: ReactNode; wide?: "num" | "full" }) {
  return (
    <div className={[s.field, wide === "num" ? s.num : wide === "full" ? s.full : null, base.className].filter(Boolean).join(" ")}>
      <label htmlFor={id} className={base.hideLabel ? "mj-sr" : s.label}>{base.label}{base.optional ? <span className={s.opt}> (선택)</span> : null}</label>
      {children}
      {base.error ? <p id={`${id}-err`} className={s.error}><Icon name="error" size={16} />{base.error}</p> : null}
      {base.hint && !base.error ? <p id={`${id}-hint`} className={s.hint}>{base.hint}</p> : null}
    </div>
  );
}
const describedBy = (id: string, b: Base) => [b.error ? `${id}-err` : null, b.hint && !b.error ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined;

export const Field = forwardRef<HTMLInputElement, Base & Omit<InputHTMLAttributes<HTMLInputElement>, "className"> & {
  /** 칸 안 오른쪽 단위 */
  unit?: string;
  /** 숫자 칸(웹 최대 240) */
  num?: boolean;
  /** 읽기만(기본 정보 잠김, C50) */
  locked?: boolean;
}>(function Field({ label, error, hint, optional, hideLabel, className, unit, num, locked, id: idProp, ...input }, ref) {
  const auto = useId();
  const id = idProp ?? auto;
  const base = { label, error, hint, optional, hideLabel, className };
  return (
    <Wrap id={id} base={base} wide={num ? "num" : undefined}>
      <div className={[s.box, error ? s.bad : null, locked ? s.locked : null].filter(Boolean).join(" ")}>
        <input
          ref={ref}
          id={id}
          className={s.input}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, base)}
          readOnly={locked || input.readOnly}
          inputMode={num && !input.inputMode ? "decimal" : input.inputMode}
          {...input}
        />
        {unit ? <span className={s.unit} aria-hidden="true">{unit}</span> : null}
        {locked ? <Icon name="lock" size={16} className={s.lock} /> : null}
      </div>
    </Wrap>
  );
});

export const TextArea = forwardRef<HTMLTextAreaElement, Base & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className">>(function TextArea(
  { label, error, hint, optional, hideLabel, className, id: idProp, rows = 4, ...rest }, ref,
) {
  const auto = useId();
  const id = idProp ?? auto;
  const base = { label, error, hint, optional, hideLabel, className };
  return (
    <Wrap id={id} base={base} wide="full">
      <div className={[s.box, s.areaBox, error ? s.bad : null].filter(Boolean).join(" ")}>
        <textarea ref={ref} id={id} rows={rows} className={`${s.input} ${s.area}`} aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, base)} {...rest} />
      </div>
    </Wrap>
  );
});

export const SelectField = forwardRef<HTMLSelectElement, Base & Omit<SelectHTMLAttributes<HTMLSelectElement>, "className"> & { options: { value: string; label: string }[] }>(function SelectField(
  { label, error, hint, optional, hideLabel, className, id: idProp, options, ...rest }, ref,
) {
  const auto = useId();
  const id = idProp ?? auto;
  const base = { label, error, hint, optional, hideLabel, className };
  return (
    <Wrap id={id} base={base}>
      <div className={[s.box, error ? s.bad : null].filter(Boolean).join(" ")}>
        <select ref={ref} id={id} className={`${s.input} ${s.select}`} aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, base)} {...rest}>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <Icon name="chevron-down" size={16} className={s.chev} />
      </div>
    </Wrap>
  );
});
