"use client";
// 켜기/끄기(design-system 3.2 Switch · 9판 k-tg): 52×32, 끔 gray-500 바탕(3.5:1) · 켬 파랑. 줄 전체가 누를 곳(48).
// 진짜 checkbox + role="switch"라 Space로 켜고 끄고, 화면 읽기는 '켬 · 끔'으로 읽어요. 바로 저장되는 설정(D14 V04 V05 V15)에 써요.
// 누르면 바로 바뀌는 것만 Switch, 보내기 단추를 눌러야 바뀌는 것은 Check를 써요.
import { useId, type ChangeEvent, type ReactNode } from "react";
import s from "./Switch.module.css";

export function Switch({ label, desc, checked, defaultChecked, onChange, disabled, name, value, hideLabel, className }: {
  label: ReactNode;
  /** 이름 아래 한 줄(13) */
  desc?: ReactNode;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (on: boolean, e: ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  name?: string;
  value?: string;
  /** 이름을 숨기고 스위치만(표 칸 안). 이름은 읽기로 남아요 */
  hideLabel?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <label className={[s.row, hideLabel ? s.bare : null, disabled ? s.off : null, className].filter(Boolean).join(" ")}>
      <span className={hideLabel ? "mj-sr" : s.text}>
        <span className={s.label}>{label}</span>
        {desc ? <span id={`${id}-d`} className={s.desc}>{desc}</span> : null}
      </span>
      <input
        type="checkbox"
        role="switch"
        className={s.input}
        name={name}
        value={value}
        checked={checked}
        defaultChecked={defaultChecked}
        disabled={disabled}
        aria-describedby={desc ? `${id}-d` : undefined}
        onChange={(e) => onChange?.(e.target.checked, e)}
      />
      <span className={s.track} aria-hidden="true" />
    </label>
  );
}
