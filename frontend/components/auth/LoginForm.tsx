"use client";
// 로그인(C06). 성공하면 API가 세션 쿠키를 심어요(화면 스크립트는 못 읽어요).
// 로그인 뒤 갈 곳: 가려던 화면(next) → 진행 중 공사 → 홈. 기기에 둔 손님 답이 있으면 내 공사로 옮기는데,
// 이미 진행 중인 공사가 있으면 홈에서 이어 하기 / 새 집을 물어요(C41 · dev-03, components/auth/after.ts).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { call, errorText, type Schemas } from "@/lib/backend/client";
import { afterAuth } from "./after";
import { withNext } from "./next";
import s from "./card.module.css";

export function LoginForm({ next, mock }: { next?: string; mock: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const go = (href: string) => { router.push(href); router.refresh(); };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!email.trim() || !password) {
      setError("이메일과 비밀번호를 모두 넣어 주세요.");
      document.getElementById(email.trim() ? "li-pw" : "li-email")?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    let me: Schemas["MeOut"];
    try {
      me = await call<Schemas["MeOut"]>("POST", "/auth/login", { email: email.trim().toLowerCase(), password });
    } catch (er) {
      setError(errorText(er));
      setBusy(false);
      document.getElementById("li-pw")?.focus();
      return;
    }
    const a = await afterAuth(me.role, next, mock);
    if (a.kind === "go") return go(a.href);
    setError(`로그인했어요. 넣은 답을 내 공사로 옮기지 못했어요: ${a.message}`);
    setBusy(false);
  }

  const desc = error ? "li-err" : undefined;
  return (
    <form className={s.card} onSubmit={onSubmit} noValidate aria-label="이메일로 로그인">
      <section className={s.group}>
        <Field id="li-email" label="이메일" type="email" autoComplete="username" maxLength={254} value={email} aria-describedby={desc} onChange={(e) => setEmail(e.target.value)} />
        <Field id="li-pw" label="비밀번호" type="password" autoComplete="current-password" maxLength={128} value={password} aria-describedby={desc} onChange={(e) => setPassword(e.target.value)} />
      </section>
      <div className={s.links}>
        <Button variant="text" gray href="/reset-password">비밀번호 찾기</Button>
        <Button variant="text" gray href={withNext("/signup", next)}>가입하기</Button>
      </div>
      {error ? <p id="li-err" className={s.err} role="alert"><Icon name="error" size={16} />{error}</p> : null}
      <div className={s.btns}>
        <Button type="submit" size="lg" block busy={busy}>{busy ? "확인하는 중" : "로그인"}</Button>
        <Button size="lg" block variant="kakao">카카오로 로그인 <Badge tone="mute">준비 중</Badge></Button>
      </div>
    </form>
  );
}
