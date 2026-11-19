"use client";
// 나눔 칸(design-system 3.2 Segmented · 9판 k-seg): 2~3칸 중 하나(공급 | 전용 · 실크 | 합지 · 무료 | 받아요 · 포함 | 빼고 | 면세 · 단가 | 다른 줄에 포함 | 빼기).
// 칸 40 · 14/600. 고른 칸은 흰 바탕 + 1.5px 파랑 테두리 + 굵게(9판은 그림자만이라 3:1이 안 돼 테두리를 더했어요). 웹 최대 360(표 안은 full).
// 진짜 radio라 ←/→ · 폼 보내기 · 화면 읽기가 그대로 돼요. value를 주면 제어, defaultValue만 주면 폼이 값을 가져가요.
import { useId, type ReactNode } from "react";
import s from "./Segmented.module.css";

export type SegmentOption = { value: string; label: ReactNode; /** 칸 안 둘째 줄(C11 '합지 / −31만 1,850원') */ sub?: ReactNode; disabled?: boolean };

export function Segmented({ legend, options, value, defaultValue, onChange, name, hideLegend, disabled, full, className }: {
  /** 묶음 이름(fieldset legend). 화면에 보이는 질문이 있으면 hideLegend */
  legend: string;
  options: SegmentOption[];
  value?: string | null;
  defaultValue?: string;
  onChange?: (v: string) => void;
  name?: string;
  hideLegend?: boolean;
  disabled?: boolean;
  /** 웹에서도 칸 너비를 다 써요(표 안 · 좁은 옆 칸) */
  full?: boolean;
  className?: string;
}) {
  const auto = useId();
  const group = name ?? auto;
  const controlled = value !== undefined;
  return (
    <fieldset className={[s.set, full ? s.full : null, className].filter(Boolean).join(" ")} disabled={disabled}>
      <legend className={hideLegend ? "mj-sr" : s.legend}>{legend}</legend>
      <div className={s.track}>
        {options.map((o) => (
          <label key={o.value} className={[s.item, o.disabled ? s.off : null].filter(Boolean).join(" ")}>
            <input
              type="radio"
              className={s.input}
              name={group}
              value={o.value}
              disabled={o.disabled}
              {...(controlled ? { checked: value === o.value, onChange: () => onChange?.(o.value) } : { defaultChecked: defaultValue === o.value, onChange: () => onChange?.(o.value) })}
            />
            <span className={s.text}>
              <span>{o.label}</span>
              {o.sub ? <span className={s.sub}>{o.sub}</span> : null}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
