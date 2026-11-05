"use client";
// 비밀번호 칸 + 보기 버튼(눈 아이콘). 누르면 글자를 보이고 aria-pressed로 상태를 알린다.
import { useState } from "react";
import s from "./auth.module.css";

type Props = {
  id: string;
  name: string;
  autoComplete: "current-password" | "new-password";
  /** 보기 버튼 이름. 예: '비밀번호 보기', '비밀번호 확인 보기' */
  toggleLabel?: string;
  invalid?: boolean;
  describedBy?: string;
  required?: boolean;
};

export function PasswordInput({ id, name, autoComplete, toggleLabel = "비밀번호 보기", invalid, describedBy, required }: Props) {
  const [show, setShow] = useState(false);
  return (
    <div className={s.pwbox}>
      <input
        id={id}
        name={name}
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        className="mj-input"
        maxLength={128}
        required={required}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
      />
      <button type="button" className={s.pwbtn} aria-pressed={show} aria-controls={id} aria-label={toggleLabel} onClick={() => setShow((v) => !v)}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="M1.8 10s3-5.6 8.2-5.6S18.2 10 18.2 10s-3 5.6-8.2 5.6S1.8 10 1.8 10z" />
          <circle cx="10" cy="10" r="2.6" />
          {show ? <path d="M3.5 3.5l13 13" /> : null}
        </svg>
      </button>
    </div>
  );
}
