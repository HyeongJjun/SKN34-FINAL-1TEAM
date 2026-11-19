"use client";
// 비밀번호 찾기(C46). 9판 글과 모양은 지키되, 아직 메일을 보내지 않으니(팀 확인 12 · 고객 대변인 F10)
// '링크 보내기'를 눌러도 '보냈어요'라고 하지 않고 사실대로 알려요(리드 결정 0장 3). 메일 API가 생기면 이 조각만 바꿔요.
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import s from "./card.module.css";

export function ResetPassword() {
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLHeadingElement>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErr("이메일 형식을 확인해 주세요. 예: name@example.com");
      ref.current?.focus();
      return;
    }
    setErr(null);
    setTried(true);
    setTimeout(() => resultRef.current?.focus(), 0);
  };

  if (tried) {
    return (
      <div className={s.card}>
        <section className={`${s.group} ${s.done}`} aria-live="polite">
          <h2 ref={resultRef} tabIndex={-1} className={s.hs}>아직 메일을 보낼 수 없어요</h2>
          <p className={s.sub}>비밀번호 찾기 메일은 준비 중이에요. 보낸 메일은 없어요.</p>
        </section>
        <Button size="lg" block href="/login">로그인으로</Button>
      </div>
    );
  }
  return (
    <form className={s.card} onSubmit={submit} noValidate aria-label="비밀번호 찾기">
      <section className={s.group}>
        <h2 className={s.hs}>가입한 이메일을 넣어 주세요</h2>
        <Field ref={ref} label="이메일" type="email" autoComplete="email" maxLength={254} value={email} error={err} onChange={(e) => setEmail(e.target.value)} />
      </section>
      <Button type="submit" size="lg" block>링크 보내기</Button>
    </form>
  );
}
