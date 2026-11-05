"use client";
// 이메일 로그인(시안 WLogin). 성공하면 API가 세션 쿠키를 심는다(화면 스크립트는 못 읽는 쿠키).
// '로그인 상태 유지'는 API가 아직 받지 않아서 두지 않는다.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { call, errorText, type Schemas } from "@/lib/backend/client";
import { readDraft } from "@/components/start/draft";
import type { Role } from "@/lib/types";
import { FieldError } from "./parts";
import { PasswordInput } from "./PasswordInput";
import { HOME, safeNext } from "./next";
import s from "./auth.module.css";

/** 로그인 뒤 가는 곳: 돌아갈 곳이 있으면 거기, 고객이 견적 받기 중이었으면 견적 받기, 아니면 역할별 첫 화면 */
function afterLogin(role: string, next?: string) {
  const n = safeNext(next);
  if (n) return n;
  if (role === "customer" && readDraft()) return "/start";
  return HOME[role as Role] ?? "/";
}

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email") ?? "").trim().toLowerCase();
    const password = String(f.get("password") ?? "");
    if (!email || !password) {
      setError("이메일과 비밀번호를 모두 적어 주세요.");
      document.getElementById(email ? "li-pw" : "li-email")?.focus();
      return;
    }
    setBusy(true);
    try {
      const me = await call<Schemas["MeOut"]>("POST", "/auth/login", { email, password });
      router.push(afterLogin(me.role, next));
      router.refresh();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
      document.getElementById("li-pw")?.focus();
    }
  }

  const desc = error ? "li-err" : undefined;
  return (
    <form className={s.form} onSubmit={onSubmit} noValidate aria-label="이메일로 로그인">
      <div className="mj-field">
        <label className="mj-label" htmlFor="li-email">이메일</label>
        <input id="li-email" name="email" type="email" autoComplete="username" className="mj-input" maxLength={254} aria-invalid={error ? true : undefined} aria-describedby={desc} />
      </div>
      <div className="mj-field">
        <label className="mj-label" htmlFor="li-pw">비밀번호</label>
        <PasswordInput id="li-pw" name="password" autoComplete="current-password" invalid={!!error} describedBy={desc} />
      </div>
      <p><Link className={s.plain} href="/reset-password">비밀번호를 잊었어요</Link></p>
      {error ? <FieldError id="li-err" alert>{error}</FieldError> : null}
      <button type="submit" className={`mj-btn mj-btn-pri ${s.submit}`} disabled={busy}>{busy ? "확인하는 중…" : "로그인"}</button>
    </form>
  );
}
