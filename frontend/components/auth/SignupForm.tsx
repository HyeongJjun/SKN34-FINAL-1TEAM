"use client";
// 이메일 가입(시안 WSignup). 오류는 칸 아래에만 보이고, 맨 위 요약 상자는 두지 않는다.
// 가입하면 바로 로그인된다(API가 세션 쿠키를 심는다).
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, call, errorText } from "@/lib/backend/client";
import { readDraft } from "@/components/start/draft";
import { FieldError, OrEmail, PHONE_MSG, Req, phoneOk } from "./parts";
import { KakaoButton } from "./KakaoButton";
import { PasswordInput } from "./PasswordInput";
import { safeNext } from "./next";
import s from "./auth.module.css";

type Key = "terms" | "name" | "phone" | "email" | "password";
type Errors = Partial<Record<Key | "form", string>>;
// 오류가 나면 이 순서로 첫 칸에 초점을 옮긴다.
const ORDER: Key[] = ["terms", "name", "phone", "email", "password"];
const FOCUS: Record<Key, string> = { terms: "su-tos", name: "su-name", phone: "su-phone", email: "su-email", password: "su-pw" };
const API_FIELDS: Key[] = ["name", "phone", "email", "password"];

const TERMS = [
  { key: "tos", id: "su-tos", need: true, label: "이용약관", href: "/legal#terms" },
  { key: "privacy", id: "su-privacy", need: true, label: "개인정보 수집 · 이용", href: "/legal#privacy" },
  { key: "marketing", id: "su-mkt", need: false, label: "공사 소식 알림 받기", href: "/legal#marketing" },
] as const;
type TermKey = (typeof TERMS)[number]["key"];

/** 가입 뒤 가는 곳: 돌아갈 곳이 있으면 거기, 견적 받기 중이었으면 견적 받기(초안으로 이어서 만든다), 아니면 내 공사 */
function afterSignup(next?: string) {
  return safeNext(next) ?? (readDraft() ? "/start" : "/my");
}

export function SignupForm({ next }: { next?: string }) {
  const router = useRouter();
  const [agree, setAgree] = useState<Record<TermKey, boolean>>({ tos: false, privacy: false, marketing: false });
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const allRef = useRef<HTMLInputElement>(null);
  const all = TERMS.every((t) => agree[t.key]);
  const some = TERMS.some((t) => agree[t.key]);
  const needOk = TERMS.every((t) => !t.need || agree[t.key]);

  useEffect(() => { if (allRef.current) allRef.current.indeterminate = some && !all; }, [some, all]);

  function focusFirst(err: Errors) {
    const k = ORDER.find((x) => err[x]);
    const id = k === "terms" ? TERMS.find((t) => t.need && !agree[t.key])?.id ?? FOCUS.terms : k ? FOCUS[k] : "su-form-err";
    setTimeout(() => document.getElementById(id)?.focus(), 0);
  }
  function setTerm(k: TermKey, v: boolean) {
    setAgree((a) => ({ ...a, [k]: v }));
    if (errors.terms) setErrors((e) => ({ ...e, terms: undefined }));
  }
  function toggleAll(v: boolean) {
    setAgree({ tos: v, privacy: v, marketing: v });
    if (errors.terms) setErrors((e) => ({ ...e, terms: undefined }));
  }

  // 카카오로 시작하기: 필수 동의를 먼저 확인한다. 카카오에서 휴대폰 번호를 받는다고 보고 휴대폰 번호 화면으로 보내지 않는다.
  function kakaoOk() {
    if (needOk) return true;
    const err = { terms: "필수 약관 두 가지에 동의해 주세요." };
    setErrors(err);
    focusFirst(err);
    return false;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name") ?? "").trim();
    const phone = String(f.get("phone") ?? "").trim();
    const email = String(f.get("email") ?? "").trim();
    const password = String(f.get("password") ?? "");
    const err: Errors = {};
    if (!needOk) err.terms = "필수 약관 두 가지에 동의해 주세요.";
    if (!name) err.name = "이름을 적어 주세요.";
    if (!phoneOk(phone)) err.phone = PHONE_MSG;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) err.email = "이메일 형식을 확인해 주세요. 예: name@example.com";
    if (password.length < 8) err.password = "비밀번호를 8자 이상으로 적어 주세요.";
    setErrors(err);
    if (Object.keys(err).length) { focusFirst(err); return; }
    setBusy(true);
    try {
      // 약관 동의(선택 동의 포함)는 아직 API가 받아 남기지 않는다 (정할 것).
      await call("POST", "/auth/signup", { name, phone, email, password });
      router.push(afterSignup(next));
      router.refresh();
    } catch (er) {
      const got: Errors = {};
      if (er instanceof ApiError && er.code === "email_taken") got.email = er.message;
      else if (er instanceof ApiError && er.fields?.length) {
        for (const fe of er.fields) {
          const k = API_FIELDS.find((x) => x === fe.loc[0]);
          if (k && !got[k]) got[k] = k === "phone" ? PHONE_MSG : fe.msg;
        }
      }
      if (!Object.keys(got).length) got.form = errorText(er);
      setErrors(got);
      setBusy(false);
      focusFirst(got);
    }
  }

  const aria = (k: Key, hint?: string) => ({
    "aria-invalid": errors[k] ? true : undefined,
    "aria-describedby": [hint, errors[k] ? `${FOCUS[k]}-e` : null].filter(Boolean).join(" ") || undefined,
  });

  return (
    <form className={s.form} onSubmit={onSubmit} noValidate aria-label="믿집 가입">
      <fieldset className={`mj-fieldset ${s.terms}`} aria-describedby={errors.terms ? "su-tos-e" : undefined}>
        <legend className="mj-label">약관 동의</legend>
        <label className={s.all}>
          <input ref={allRef} id="su-all" type="checkbox" className={s.ck} checked={all} onChange={(e) => toggleAll(e.target.checked)} />
          전체 동의 <span className={s.req}>(선택 포함)</span>
        </label>
        <ul className={s.termList}>
          {TERMS.map((t) => (
            <li key={t.key}>
              <label className={s.term}>
                <input id={t.id} type="checkbox" className={s.ck} checked={agree[t.key]} required={t.need} onChange={(e) => setTerm(t.key, e.target.checked)} />
                <span><span className={s.req}>{t.need ? "(필수)" : "(선택)"}</span> {t.label}</span>
              </label>
              <Link className={s.see} href={t.href}>
                <span className="mj-sr">{t.label} </span>보기
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 3l4 4-4 4" /></svg>
              </Link>
            </li>
          ))}
        </ul>
        {errors.terms ? <FieldError id="su-tos-e">{errors.terms}</FieldError> : null}
      </fieldset>

      <KakaoButton label="카카오로 시작하기" soon="카카오 가입은 준비 중이에요. 지금은 아래 칸을 채워 이메일로 가입해 주세요." onBefore={kakaoOk} />
      <OrEmail />

      <div className="mj-field">
        <label className="mj-label" htmlFor="su-name">이름 <Req /></label>
        <input id="su-name" name="name" autoComplete="name" className="mj-input" maxLength={50} required {...aria("name")} />
        {errors.name ? <FieldError id="su-name-e">{errors.name}</FieldError> : null}
      </div>
      <div className="mj-field">
        <label className="mj-label" htmlFor="su-phone">휴대폰 번호 <Req /></label>
        <input id="su-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" className="mj-input mj-num" maxLength={20} required {...aria("phone")} />
        {errors.phone ? <FieldError id="su-phone-e">{errors.phone}</FieldError> : null}
      </div>
      <div className="mj-field">
        <label className="mj-label" htmlFor="su-email">이메일 <Req /></label>
        <input id="su-email" name="email" type="email" autoComplete="email" className="mj-input" maxLength={254} required {...aria("email")} />
        {errors.email ? <FieldError id="su-email-e">{errors.email}</FieldError> : null}
      </div>
      <div className="mj-field">
        <label className="mj-label" htmlFor="su-pw">비밀번호 <Req /></label>
        <PasswordInput id="su-pw" name="password" autoComplete="new-password" required invalid={!!errors.password} describedBy={aria("password", "su-pw-h")["aria-describedby"]} />
        <p id="su-pw-h" className="mj-hint">8자 이상</p>
        {errors.password ? <FieldError id="su-pw-e">{errors.password}</FieldError> : null}
      </div>

      <button type="submit" className={`mj-btn mj-btn-pri ${s.submit}`} disabled={busy}>{busy ? "가입하는 중…" : "가입하기"}</button>
      {errors.form ? <div id="su-form-err" tabIndex={-1}><FieldError id="su-form-e" alert>{errors.form}</FieldError></div> : null}
    </form>
  );
}
