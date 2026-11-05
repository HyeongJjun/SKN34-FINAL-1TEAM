"use client";
// 내 정보 · 기본 정보 (시안 WAccount 01). 이름 · 휴대폰은 '바꾸기'를 누르면 그 줄에서 고치고 PATCH /me로 저장한다.
// 이메일은 로그인 아이디라 바꾸는 서버 기능이 아직 없어서 글자로만 보인다. 업체 연락처(휴대폰)는 업체 정보에서 바꾼다.
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { call, errorText } from "@/lib/backend/client";
import { phoneText } from "@/lib/labels";
import { PHONE_MSG, phoneOk } from "@/components/auth/parts";
import s from "./account.module.css";

type Field = "name" | "phone";

function EditRow({ field, label, value, shown, hint }: { field: Field; label: string; value: string; shown: string; hint?: string }) {
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const id = `ac-${field}`;

  function open() { setErr(""); setDone(false); setEdit(true); setTimeout(() => input.current?.focus(), 0); }
  function close() { setEdit(false); setErr(""); setTimeout(() => opener.current?.focus(), 0); }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const v = (input.current?.value ?? "").trim();
    if (!v) { setErr(field === "name" ? "이름을 적어 주세요." : "휴대폰 번호를 적어 주세요."); input.current?.focus(); return; }
    if (field === "phone" && !phoneOk(v)) { setErr(PHONE_MSG); input.current?.focus(); return; }
    setBusy(true); setErr("");
    try {
      await call("PATCH", "/me", { [field]: v });
      setEdit(false); setDone(true);
      router.refresh();
      setTimeout(() => opener.current?.focus(), 0);
    } catch (er) {
      setErr(errorText(er));
      input.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`${s.ln} ${edit ? s.editing : ""}`}>
      <dt>{edit ? <label htmlFor={id}>{label}</label> : label}</dt>
      {edit ? (
        <dd className={s.grow}>
          <form className={s.editForm} noValidate onSubmit={save} aria-label={`${label} 바꾸기`}>
            <input ref={input} id={id} className={`mj-input ${s.inp} ${field === "phone" ? "mj-num" : ""}`} defaultValue={value}
              type={field === "phone" ? "tel" : "text"} inputMode={field === "phone" ? "numeric" : undefined} autoComplete={field === "phone" ? "tel" : "name"} maxLength={field === "phone" ? 20 : 50}
              aria-invalid={err ? true : undefined} aria-describedby={[err ? `${id}-err` : "", hint ? `${id}-h` : ""].filter(Boolean).join(" ") || undefined} />
            <button type="submit" className="mj-btn mj-btn-pri mj-btn-sm" disabled={busy}>{busy ? "저장 중…" : "저장"}</button>
            <button type="button" className="mj-btn mj-btn-sec mj-btn-sm" onClick={close} disabled={busy}>취소</button>
          </form>
          {err ? <p id={`${id}-err`} className="mj-error" role="alert">{err}</p> : null}
          {hint ? <p id={`${id}-h`} className="mj-hint">{hint}</p> : null}
        </dd>
      ) : (
        <>
          <dd className={`${s.grow} mj-num`}>{shown}{done ? <span className={`mj-small ${s.done}`} role="status"> · 바꿨어요</span> : null}</dd>
          <dd className={s.act}><button ref={opener} type="button" className="mj-btn mj-btn-sec mj-btn-sm" onClick={open}><span className="mj-sr">{label} </span>{value ? "바꾸기" : "넣기"}</button></dd>
        </>
      )}
    </div>
  );
}

export function AccountRows({ name, phone, email, vendor }: { name: string; phone: string | null; email: string; vendor: boolean }) {
  return (
    <dl className={s.rows}>
      <EditRow field="name" label="이름" value={name} shown={name} />
      {vendor ? (
        <div className={s.ln}>
          <dt>휴대폰</dt>
          <dd className={s.grow}><span className="mj-small">업체 연락처는 업체 정보에서 바꿔요.</span></dd>
          <dd className={s.act}><Link className="mj-btn mj-btn-sec mj-btn-sm" href="/vendor/profile">업체 정보</Link></dd>
        </div>
      ) : (
        <EditRow field="phone" label="휴대폰" value={phone ? phoneText(phone) : ""} shown={phone ? phoneText(phone) : "넣지 않았어요"} hint="바꾸면 연락처를 보낸 업체 화면에도 새 번호가 보여요." />
      )}
      <div className={s.ln}>
        <dt>이메일</dt>
        <dd className={s.grow}>{email}</dd>
      </div>
    </dl>
  );
}
