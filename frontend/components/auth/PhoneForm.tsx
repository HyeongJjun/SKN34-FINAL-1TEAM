"use client";
// 휴대폰 번호 넣기(시안 WPhone). 로그인한 사람은 PATCH /me로 번호를 저장한다.
// 문자 인증은 나중 작업: '인증번호 받기'는 문자를 보내지 않고 인증번호 칸과 남은 시간만 보인다. 인증번호는 서버에서 확인하지 않는다.
// 카카오 가입도 나중 작업: 로그인 안 한 사람(카카오 흐름)이 '가입 마치기'를 누르면 준비 중 안내만 보인다.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, call, errorText } from "@/lib/backend/client";
import { readDraft } from "@/components/start/draft";
import type { Role } from "@/lib/types";
import { FieldError, PHONE_MSG, Req, phoneOk } from "./parts";
import { HOME, withNext } from "./next";
import s from "./auth.module.css";

const LIMIT_MS = 3 * 60 * 1000; // 인증번호를 넣을 수 있는 시간
const EXPIRED = "시간이 지났어요. 인증번호를 다시 받아 주세요.";

type Props = {
  /** 로그인한 사람의 역할. 없으면 카카오 가입 흐름 */
  role: Role | null;
  /** 저장한 뒤 돌아갈 곳(업체 고르기 등). 이 사이트 안 경로만 */
  next: string | null;
  submitLabel: string;
  /** 견적 받기 초안이 있으면 '이어서 계산해요'를 보인다(돌아갈 곳이 따로 있으면 안 보인다) */
  draftNote: boolean;
};

export function PhoneForm({ role, next, submitLabel, draftNote }: Props) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [until, setUntil] = useState<number | null>(null); // 인증번호를 받은 뒤 끝나는 때
  const [now, setNow] = useState(0);
  const [phoneErr, setPhoneErr] = useState<string | null>(null);
  const [codeErr, setCodeErr] = useState<string | null>(null);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [kakaoSoon, setKakaoSoon] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);

  const left = until === null ? 0 : Math.max(0, Math.ceil((until - now) / 1000));
  const expired = until !== null && left === 0;

  useEffect(() => { setHasDraft(!!readDraft()); }, []);
  useEffect(() => {
    if (until === null || expired) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [until, expired]);

  function onPhone(v: string) {
    setPhone(v);
    setPhoneErr(null);
    // 번호를 바꾸면 인증번호를 다시 받는다
    if (until !== null) { setUntil(null); setCode(""); setCodeErr(null); }
  }

  function send() {
    setFormErr(null);
    if (!phoneOk(phone)) { setPhoneErr(PHONE_MSG); document.getElementById("ph-no")?.focus(); return; }
    const t = Date.now();
    setNow(t);
    setUntil(t + LIMIT_MS);
    setCode("");
    setCodeErr(null);
    setTimeout(() => document.getElementById("ph-code")?.focus(), 0);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormErr(null);
    if (!role) { setKakaoSoon(true); return; }
    let pErr: string | null = null;
    let cErr: string | null = null;
    if (!phoneOk(phone)) pErr = PHONE_MSG;
    else if (until === null) pErr = "인증번호를 받아 주세요.";
    else if (expired) cErr = EXPIRED;
    else if (!/^\d{6}$/.test(code)) cErr = "문자로 받은 숫자 6자리를 넣어 주세요.";
    setPhoneErr(pErr);
    setCodeErr(cErr);
    if (pErr || cErr) { document.getElementById(pErr ? "ph-no" : "ph-code")?.focus(); return; }
    setBusy(true);
    try {
      await call("PATCH", "/me", { phone });
      router.push(next ?? (role === "customer" && readDraft() ? "/start" : HOME[role]));
      router.refresh();
    } catch (er) {
      setBusy(false);
      if (er instanceof ApiError && er.fields?.some((f) => f.loc[0] === "phone")) { setPhoneErr(PHONE_MSG); document.getElementById("ph-no")?.focus(); }
      else setFormErr(errorText(er));
    }
  }

  const codeMsg = codeErr ?? (expired ? EXPIRED : null);
  const phoneDesc = [until !== null ? "ph-no-h" : null, phoneErr ? "ph-no-e" : null].filter(Boolean).join(" ") || undefined;
  return (
    <form className={s.form} onSubmit={onSubmit} noValidate aria-label="휴대폰 번호 확인">
      <div className="mj-field">
        <label className="mj-label" htmlFor="ph-no">휴대폰 번호 <Req /></label>
        <div className={s.pair}>
          <input id="ph-no" name="phone" type="tel" inputMode="tel" autoComplete="tel" className="mj-input mj-num" maxLength={20} required value={phone} onChange={(e) => onPhone(e.target.value)} aria-invalid={phoneErr ? true : undefined} aria-describedby={phoneDesc} />
          <button type="button" className="mj-btn mj-btn-sec" onClick={send}>{until === null ? "인증번호 받기" : "인증번호 다시 받기"}</button>
        </div>
        {until !== null ? <p id="ph-no-h" className="mj-hint">문자 인증은 준비 중이에요. 지금은 문자가 가지 않으니 숫자 6자리를 아무거나 넣어 주세요.</p> : null}
        {phoneErr ? <FieldError id="ph-no-e">{phoneErr}</FieldError> : null}
      </div>

      {until !== null ? (
        <div className="mj-field">
          <label className="mj-label" htmlFor="ph-code">인증번호 <Req /></label>
          <div className={s.codebox}>
            <input id="ph-code" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" className="mj-input mj-num" maxLength={6} required value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, "")); setCodeErr(null); }} aria-invalid={codeMsg ? true : undefined} aria-describedby={["ph-code-h", "ph-time", codeMsg ? "ph-code-e" : null].filter(Boolean).join(" ")} />
            <span id="ph-time" className={s.left}>남은 시간 <b className="mj-num">{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</b></span>
          </div>
          <p id="ph-code-h" className="mj-hint">문자로 받은 숫자 6자리예요.</p>
          {codeMsg ? <FieldError id="ph-code-e" alert={!codeErr}>{codeMsg}</FieldError> : null}
        </div>
      ) : null}

      <button type="submit" className={`mj-btn mj-btn-pri ${s.submit}`} disabled={busy}>{busy ? "저장하는 중…" : submitLabel}</button>
      {kakaoSoon ? (
        <div className={`mj-notice ${s.notice}`} role="alert">
          <span>카카오 가입은 준비 중이에요. 지금은 <Link href={withNext("/signup", next)}>이메일로 가입</Link>해 주세요.</span>
        </div>
      ) : null}
      {formErr ? <FieldError id="ph-form-e" alert>{formErr}</FieldError> : null}
      {hasDraft && draftNote ? <p className="mj-small">가입을 마치면 넣은 집 정보 · 사진으로 이어서 계산해요.</p> : null}
    </form>
  );
}
