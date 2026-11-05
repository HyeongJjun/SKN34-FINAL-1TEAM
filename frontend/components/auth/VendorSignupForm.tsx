"use client";
// 업체 가입 신청 (시안 WVSignup): 1 기본 정보 · 2 사업자 확인 · 3 신청 확인을 한 장에 두고 위에 단계 표시.
// 새로 신청: 신청서 + 사업자등록증을 multipart로 POST /auth/vendor-signup → 로그인된 채 업체 홈(/vendor).
// 다시 신청(again): 거절된 업체가 로그인한 채 온다. 지난 값을 채우고 이메일 · 비밀번호 · 약관 칸은 없다.
//   새 등록증은 먼저 POST /files(kind=license) → POST /vendor/application/reapply. 사업자등록번호는 못 바꾼다.
// 오류는 칸 아래에만 보인다. 휴대폰 · 비밀번호 확인 · 사업자등록번호는 칸을 떠날 때도 알린다.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Region } from "@/lib/api/project";
import { ApiError, call, errorText, type Schemas } from "@/lib/backend/client";
import { fileSize, stampSeoul } from "@/lib/format";
import { bizNoText, phoneText, tradeLabel } from "@/lib/labels";
import { FieldError, PHONE_MSG, phoneOk } from "./parts";
import { PasswordInput } from "./PasswordInput";
import s from "./VendorSignupForm.module.css";

// 사업자등록증: 서버 규칙과 같게 (backend/app/files/service.py RULES["license"])
export const LICENSE_TYPES = ["image/jpeg", "image/png", "application/pdf"];
export const LICENSE_MB = 10;
const LICENSE_ACCEPT = ".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf";
const FILE_CODES = ["file_type", "file_too_big", "file_broken", "file_empty", "file_kind", "file"];

/** 고른 파일을 미리 본다. 서버가 다시 검사한다 */
export function licenseError(f: File): string | null {
  if (!f.size) return "빈 파일이에요.";
  if (f.type && !LICENSE_TYPES.includes(f.type)) return "이 형식의 파일은 올릴 수 없어요.";
  if (!f.type && !/\.(jpe?g|png|pdf)$/i.test(f.name)) return "이 형식의 파일은 올릴 수 없어요.";
  if (f.size > LICENSE_MB * 1024 * 1024) return `${LICENSE_MB}MB까지 올릴 수 있어요.`;
  return null;
}
/** 새 사업자등록증을 먼저 올리고 파일 id를 받는다 (보완 · 다시 신청) */
export async function uploadLicense(f: File): Promise<string> {
  const fd = new FormData();
  fd.append("kind", "license");
  fd.append("file", f, f.name);
  return (await call<Schemas["FileOut"]>("POST", "/files", fd)).id;
}
/** 파일 오류 코드면 파일 칸에 보일 문장, 아니면 null */
export function fileErrorText(e: unknown): string | null {
  return e instanceof ApiError && FILE_CODES.includes(e.code) ? e.message : null;
}
const kindText = (f: File) => (f.type === "application/pdf" || /\.pdf$/i.test(f.name) ? "PDF" : f.type === "image/png" || /\.png$/i.test(f.name) ? "PNG" : "JPG");

/** 사업자등록증 칸 (시안 WVSignup): 점선 칸의 '파일 고르기' + 고른 파일 한 줄(다시 고르기 · 빼기). 끌어다 놓아도 된다 */
export function LicenseField({ id, label, file, onPick, onClear, error, hint, note }: {
  id: string; label: string; file: File | null; onPick: (f: File) => void; onClear: () => void; error?: string; hint: string; note?: ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const pickBtn = useRef<HTMLButtonElement>(null);
  const take = (list: FileList | null) => { const f = list?.[0]; if (f) onPick(f); };
  const desc = [`${id}-h`, error ? `${id}-e` : ""].filter(Boolean).join(" ");
  return (
    <div className="mj-field" role="group" aria-labelledby={`${id}-l`}>
      <p id={`${id}-l`} className="mj-label">{label}</p>
      <div
        className={`${s.drop}${over ? ` ${s.over}` : ""}`}
        onDragEnter={(e) => { e.preventDefault(); setOver(true); }}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false); }}
        onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files); }}
      >
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M14 18V5M8.5 10.5L14 5l5.5 5.5" /><path d="M5 18v4.5h18V18" /></svg>
        <button ref={pickBtn} id={id} type="button" className="mj-btn mj-btn-sec" aria-describedby={desc} onClick={() => input.current?.click()}>{file ? "다시 고르기" : "파일 고르기"}<span className="mj-sr"> · {label}</span></button>
        <p id={`${id}-h`} className="mj-hint">{hint}</p>
        <input ref={input} type="file" className="mj-sr" tabIndex={-1} aria-hidden="true" accept={LICENSE_ACCEPT} onChange={(e) => { take(e.target.files); e.target.value = ""; }} />
      </div>
      {file ? (
        <ul className={s.files} aria-label="고른 파일">
          <li>
            <svg width="40" height="52" viewBox="0 0 40 52" fill="none" aria-hidden="true" className={s.fileMark}><rect x="0.5" y="0.5" width="39" height="51" rx="2" fill="var(--bg)" stroke="var(--line-strong)" /><path d="M8 9h22" stroke="var(--ink)" strokeWidth="3" /><path d="M7 18h26M7 24h26M7 30h26M7 36h18" stroke="var(--line-paper)" /></svg>
            <span className={s.fmeta}>
              <span className={s.fname}>{file.name}</span>
              <span className="mj-small mj-num">{kindText(file)} · {fileSize(file.size)}</span>
            </span>
            <span className={`mj-st mj-st-ok ${s.wrap}`}><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M2.5 7.5l3 3 6-7" /></svg>골랐어요 · 신청할 때 함께 보내요</span>
            <button type="button" className="mj-btn mj-btn-danger mj-btn-sm" aria-label={`${file.name} 빼기`} onClick={() => { onClear(); pickBtn.current?.focus(); }}>빼기</button>
          </li>
        </ul>
      ) : null}
      {note}
      {error ? <FieldError id={`${id}-e`}>{error}</FieldError> : null}
    </div>
  );
}

type Prev = { biz_name: string; owner_name: string; phone: string; biz_no: string; trades: string[]; areas: { sido: string; sgg: string }[]; fileName: string | null };
export type Again = { email: string; appliedAt: string | null; prev: Prev };
type Key = "bizName" | "owner" | "phone" | "email" | "pw" | "pw2" | "bizNo" | "file" | "trades" | "areas" | "terms" | "privacy" | "form";
type Errs = Partial<Record<Key, string>>;
const ORDER: Key[] = ["bizName", "owner", "phone", "email", "pw", "pw2", "bizNo", "file", "trades", "areas", "terms", "privacy", "form"];
const FOCUS: Record<Key, string> = {
  bizName: "v-name", owner: "v-ceo", phone: "v-tel", email: "v-mail", pw: "v-pw", pw2: "v-pw2", bizNo: "v-biz", file: "v-doc",
  trades: "v-tr-dobae", areas: "v-sido", terms: "v-ag-terms", privacy: "v-ag-privacy", form: "v-form-e",
};
const API_KEY: Record<string, Key> = {
  email: "email", password: "pw", biz_name: "bizName", owner_name: "owner", biz_no: "bizNo", phone: "phone",
  trades: "trades", areas: "areas", license_file: "file", license_file_id: "file",
};
const TRADES = ["dobae", "mokgong"] as const;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const AGREE = [
  { k: "terms", id: "v-ag-terms", label: "업체 이용약관에 동의해요 (필수)", see: "업체 이용약관", href: "/legal#vendor-terms" },
  { k: "privacy", id: "v-ag-privacy", label: "개인정보 수집 · 이용에 동의해요 (필수)", see: "개인정보 수집 · 이용 내용", href: "/legal#privacy" },
  { k: "news", id: "v-ag-news", label: "공사 소식 알림 받기 (선택)", see: "공사 소식 알림 받기 내용", href: "/legal#marketing" },
] as const;
type AgreeKey = (typeof AGREE)[number]["k"];

const digits = (v: string) => v.replace(/\D/g, "");
/** 사업자등록번호 칸: 숫자만 받고 - 는 저절로 붙인다 (214-86-03518) */
function bizInput(v: string) {
  const d = digits(v).slice(0, 10);
  return d.length > 5 ? `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}` : d.length > 3 ? `${d.slice(0, 3)}-${d.slice(3)}` : d;
}
function areaLabel(regions: Region[], key: string) {
  const [sido, sgg] = key.split("/");
  const r = regions.find((x) => x.id === sido);
  const g = r?.groups.find((x) => x.items.includes(sgg));
  return g?.prefix ? `${g.prefix} ${sgg}` : sgg ?? key;
}

function Mark({ k }: { k: "ok" | "now" | "off" }) {
  if (k === "ok") return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M2.5 7.5l3 3 6-7" /></svg>;
  if (k === "now") return <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="4" fill="currentColor" /></svg>;
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 7h8" /></svg>;
}
const STEP_TEXT = { done: "끝남", now: "지금", left: "남음" } as const;
const STEP_CLS = { done: "mj-st-ok", now: "mj-st-now", left: "mj-st-off" } as const;
const STEP_MARK = { done: "ok", now: "now", left: "off" } as const;

export function VendorSignupForm({ regions, again }: { regions: Region[]; again?: Again }) {
  const router = useRouter();
  const p = again?.prev;
  const [bizName, setBizName] = useState(p?.biz_name ?? "");
  const [owner, setOwner] = useState(p?.owner_name ?? "");
  const [phone, setPhone] = useState(phoneText(p?.phone));
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [bizNo, setBizNo] = useState(p?.biz_no ? bizInput(p.biz_no) : "");
  const [file, setFile] = useState<File | null>(null);
  const [trades, setTrades] = useState<string[]>(p?.trades ?? []);
  const [areas, setAreas] = useState<string[]>(p?.areas.map((a) => `${a.sido}/${a.sgg}`) ?? []);
  const [sido, setSido] = useState(p?.areas[0]?.sido ?? regions[0]?.id ?? "seoul");
  const [agree, setAgree] = useState<Record<AgreeKey, boolean>>({ terms: false, privacy: false, news: false });
  const [errors, setErrors] = useState<Errs>({});
  const [busy, setBusy] = useState(false);
  const [bizTaken, setBizTaken] = useState(false); // 이미 신청한 사업자등록번호 (서버가 알려 줌)
  const allRef = useRef<HTMLInputElement>(null);
  const allOn = AGREE.every((a) => agree[a.k]);
  const someOn = AGREE.some((a) => agree[a.k]);
  useEffect(() => { if (allRef.current) allRef.current.indeterminate = someOn && !allOn; }, [someOn, allOn]);

  const region = regions.find((r) => r.id === sido);
  const pwSame = !!pw2 && pw === pw2;

  // 단계 표시: 다 채운 단계는 '끝남', 처음 덜 채운 단계가 '지금'
  const done1 = !!bizName.trim() && !!owner.trim() && phoneOk(phone) && (!!again || (EMAIL.test(email.trim()) && pw.length >= 8 && pwSame));
  const done2 = (!!again || (digits(bizNo).length === 10 && !!file)) && trades.length > 0 && areas.length > 0;
  const done3 = !!again || (agree.terms && agree.privacy);
  const flags = [done1, done2, done3];
  const first = flags.findIndex((x) => !x);
  const step = (i: number): keyof typeof STEP_TEXT => (flags[i] ? "done" : i === first ? "now" : "left");
  const steps = [{ id: "v1", t: "기본 정보" }, { id: "v2", t: "사업자 확인" }, { id: "v3", t: "신청 확인" }].map((x, i) => ({ ...x, st: step(i) }));

  function clear(k: Key) { if (errors[k] || errors.form) setErrors((e) => ({ ...e, [k]: undefined, form: undefined })); }
  function focusFirst(e: Errs) {
    const k = ORDER.find((x) => e[x]);
    if (k) setTimeout(() => document.getElementById(FOCUS[k])?.focus(), 0);
  }
  function toggle(list: string[], v: string, on: boolean) { return on ? (list.includes(v) ? list : [...list, v]) : list.filter((x) => x !== v); }
  function setAgreeAll(on: boolean) { setAgree({ terms: on, privacy: on, news: on }); clear("terms"); clear("privacy"); }

  function validate(): Errs {
    const e: Errs = {};
    if (!bizName.trim()) e.bizName = "상호를 적어 주세요.";
    if (!owner.trim()) e.owner = "대표자 이름을 적어 주세요.";
    if (!phoneOk(phone)) e.phone = PHONE_MSG;
    if (!again) {
      if (!EMAIL.test(email.trim())) e.email = "이메일 형식을 확인해 주세요. 예: name@example.com";
      if (pw.length < 8) e.pw = "비밀번호를 8자 이상으로 적어 주세요.";
      if (pw2 !== pw) e.pw2 = "비밀번호가 달라요.";
      if (digits(bizNo).length !== 10) e.bizNo = "사업자등록번호 10자리를 넣어 주세요.";
      if (!file) e.file = "사업자등록증 파일을 올려 주세요.";
      if (!agree.terms) e.terms = "업체 이용약관에 동의해 주세요.";
      if (!agree.privacy) e.privacy = "개인정보 수집 · 이용에 동의해 주세요.";
    }
    if (file && licenseError(file)) e.file = licenseError(file) ?? undefined;
    if (!trades.length) e.trades = "하는 공정을 하나 이상 골라 주세요.";
    if (!areas.length) e.areas = "활동 지역을 하나 이상 골라 주세요.";
    return e;
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (busy) return;
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) { focusFirst(e); return; }
    setBusy(true);
    const areaIn = areas.map((a) => { const [sd, sg] = a.split("/"); return { sido: sd, sgg: sg }; });
    const tradeIn = TRADES.filter((t) => trades.includes(t));
    try {
      if (again) {
        const license_file_id = file ? await uploadLicense(file) : undefined;
        const body: Schemas["ReapplyIn"] = { biz_name: bizName.trim(), owner_name: owner.trim(), phone: digits(phone), trades: tradeIn, areas: areaIn, ...(license_file_id ? { license_file_id } : {}) };
        await call("POST", "/vendor/application/reapply", body);
      } else {
        const fd = new FormData();
        fd.append("email", email.trim());
        fd.append("password", pw);
        fd.append("biz_name", bizName.trim());
        fd.append("owner_name", owner.trim());
        fd.append("biz_no", digits(bizNo));
        fd.append("phone", digits(phone));
        tradeIn.forEach((t) => fd.append("trades", t));
        areas.forEach((a) => fd.append("areas", a));
        fd.append("license_file", file as File, (file as File).name);
        // '공사 소식 알림 받기'(선택) 동의는 아직 서버가 받아 남기지 않는다
        await call("POST", "/auth/vendor-signup", fd);
      }
      router.push("/vendor");
      router.refresh();
    } catch (er) {
      const got: Errs = {};
      const fileMsg = fileErrorText(er);
      if (fileMsg) got.file = fileMsg;
      else if (er instanceof ApiError && er.code === "email_taken") got.email = er.message;
      else if (er instanceof ApiError && er.code === "biz_no_taken") { got.bizNo = er.message; setBizTaken(true); }
      else if (er instanceof ApiError && er.code === "region") got.areas = er.message;
      else if (er instanceof ApiError && er.fields?.length) {
        for (const f of er.fields) {
          const k = API_KEY[f.loc[0] ?? ""] ?? "form";
          if (!got[k]) got[k] = k === "phone" ? PHONE_MSG : f.msg;
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
  const err = (k: Key) => (errors[k] ? <FieldError id={`${FOCUS[k]}-e`}>{errors[k]}</FieldError> : null);
  const before = (now: string, old?: string) => (again && old !== undefined && now.trim() !== old ? <p className="mj-hint">지난 신청: {old}</p> : null);
  // 단계(지금 · 남음)는 위 단계 줄에만 보인다
  const head = (no: number, t: string) => (
    <div className={s.sh}>
      <span className="mj-code" aria-hidden="true">{no}</span>
      <h2 id={`v${no}-t`} className="mj-h2">{t}</h2>
    </div>
  );
  const areaText = areas.map((a) => areaLabel(regions, a)).join(" · ");
  const fileText = file ? `사업자등록증 1개 (${kindText(file)})` : again?.prev.fileName ? `지난 파일 (${again.prev.fileName})` : "아직 안 골랐어요";

  return (
    <>
      <nav aria-label="가입 단계">
        <ol className={s.steps}>
          {steps.map((x, i) => (
            <li key={x.id} className={x.st === "done" ? s.done : undefined}>
              <a href={`#${x.id}`} aria-current={x.st === "now" ? "step" : undefined}>
                <span className="mj-code" aria-hidden="true">{i + 1}</span>{x.t}
                <span className={`mj-st ${STEP_CLS[x.st]}`}><Mark k={STEP_MARK[x.st]} />{STEP_TEXT[x.st]}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className={s.cols}>
        <form noValidate aria-label={again ? "업체 다시 신청서" : "업체 가입 신청서"} className={s.form} onSubmit={onSubmit}>
          {again ? (
            <div className={s.againNote}>
              <p className="mj-notice"><span><b>지금 계정으로 다시 신청해요</b> · {again.email}</span></p>
              <p className="mj-small mj-num">{again.appliedAt ? `지난 신청(${stampSeoul(new Date(again.appliedAt))}) 값을 채워 뒀어요.` : "지난 신청 값을 채워 뒀어요."} 바꾼 칸은 관리자에게 &lsquo;바뀐 칸&rsquo;으로 보여요.</p>
            </div>
          ) : null}

          <section id="v1" className={s.sec} aria-labelledby="v1-t">
            {head(1, "기본 정보")}
            <div className={s.fg}>
              <div className="mj-field">
                <label className="mj-label" htmlFor="v-name">상호 (필수)</label>
                <input id="v-name" className="mj-input" autoComplete="organization" maxLength={100} required value={bizName} onChange={(e) => { setBizName(e.target.value); clear("bizName"); }} {...aria("bizName")} />
                {before(bizName, p?.biz_name)}
                {err("bizName")}
              </div>
              <div className="mj-field">
                <label className="mj-label" htmlFor="v-ceo">대표자 이름 (필수)</label>
                <input id="v-ceo" className="mj-input" autoComplete="name" maxLength={50} required value={owner} onChange={(e) => { setOwner(e.target.value); clear("owner"); }} {...aria("owner")} />
                {before(owner, p?.owner_name)}
                {err("owner")}
              </div>
              <div className="mj-field">
                <label className="mj-label" htmlFor="v-tel">휴대폰 (필수)</label>
                <input
                  id="v-tel" className="mj-input mj-num" type="tel" inputMode="tel" autoComplete="tel" maxLength={20} required value={phone}
                  onChange={(e) => { setPhone(e.target.value); clear("phone"); }}
                  onBlur={() => { if (phone && !phoneOk(phone)) setErrors((x) => ({ ...x, phone: PHONE_MSG })); }}
                  {...aria("phone", "v-tel-h")}
                />
                <p id="v-tel-h" className="mj-hint">승인 뒤 실측을 요청한 고객에게 대표 이름과 이 번호가 보여요.</p>
                {err("phone")}
              </div>
              {again ? null : (
                <>
                  <div className="mj-field">
                    <label className="mj-label" htmlFor="v-mail">이메일 (필수)</label>
                    <input id="v-mail" className="mj-input" type="email" autoComplete="email" maxLength={254} required value={email} onChange={(e) => { setEmail(e.target.value); clear("email"); }} {...aria("email", "v-mail-h")} />
                    <p id="v-mail-h" className="mj-hint">로그인 아이디로 써요.</p>
                    {err("email")}
                  </div>
                  <div className="mj-field" onChange={(e) => { setPw((e.target as HTMLInputElement).value); clear("pw"); }}>
                    <label className="mj-label" htmlFor="v-pw">비밀번호 (필수)</label>
                    <PasswordInput id="v-pw" name="password" autoComplete="new-password" required invalid={!!errors.pw} describedBy={aria("pw", "v-pw-h")["aria-describedby"]} />
                    <p id="v-pw-h" className="mj-hint">8자 이상</p>
                    {err("pw")}
                  </div>
                  <div
                    className="mj-field"
                    onChange={(e) => { setPw2((e.target as HTMLInputElement).value); clear("pw2"); }}
                    onBlur={(e) => { if (e.target instanceof HTMLInputElement && e.target.id === "v-pw2" && pw2 && pw2 !== pw) setErrors((x) => ({ ...x, pw2: "비밀번호가 달라요." })); }}
                  >
                    <label className="mj-label" htmlFor="v-pw2">비밀번호 확인 (필수)</label>
                    <PasswordInput id="v-pw2" name="password2" autoComplete="new-password" toggleLabel="비밀번호 확인 보기" required invalid={!!errors.pw2} describedBy={aria("pw2", "v-pw2-s")["aria-describedby"]} />
                    <p id="v-pw2-s" className="mj-st mj-st-ok" aria-live="polite">{pwSame && !errors.pw2 ? <><Mark k="ok" />비밀번호가 같아요</> : null}</p>
                    {err("pw2")}
                  </div>
                </>
              )}
            </div>
          </section>

          <section id="v2" className={s.sec} aria-labelledby="v2-t">
            {head(2, "사업자 확인")}
            <div className={`mj-field ${s.narrow}`}>
              <label className="mj-label" htmlFor="v-biz">사업자등록번호{again ? "" : " (필수)"}</label>
              {again ? (
                <>
                  <input id="v-biz" className={`mj-input mj-num ${s.readonly}`} value={bizNoText(p?.biz_no)} readOnly aria-describedby="v-biz-h" />
                  <p id="v-biz-h" className="mj-hint">같은 번호로 다시 신청해요.</p>
                </>
              ) : (
                <>
                  <input
                    id="v-biz" className="mj-input mj-num" inputMode="numeric" autoComplete="off" maxLength={12} required value={bizNo}
                    onChange={(e) => { setBizNo(bizInput(e.target.value)); setBizTaken(false); clear("bizNo"); }}
                    onBlur={() => { if (bizNo && digits(bizNo).length !== 10) setErrors((x) => ({ ...x, bizNo: "사업자등록번호 10자리를 넣어 주세요." })); }}
                    {...aria("bizNo", "v-biz-h")}
                  />
                  <p id="v-biz-h" className="mj-hint">숫자 10자리만 넣어요. - 는 저절로 붙어요.</p>
                  {err("bizNo")}
                  {bizTaken && errors.bizNo ? <p className="mj-small">거절된 번호는 그 계정으로 로그인해 업체 홈에서 다시 신청할 수 있어요.</p> : null}
                </>
              )}
            </div>

            <LicenseField
              id="v-doc"
              label={again ? "사업자등록증 다시 올리기 (선택)" : "사업자등록증 (필수)"}
              file={file}
              onPick={(f) => { const m = licenseError(f); if (m) { setFile(null); setErrors((x) => ({ ...x, file: `${f.name} · ${m}` })); } else { setFile(f); clear("file"); } }}
              onClear={() => { setFile(null); clear("file"); }}
              error={errors.file}
              hint={again && p?.fileName ? `안 올리면 지난 파일(${p.fileName})로 다시 봐요. JPG · PNG · PDF, ${LICENSE_MB}MB까지` : `JPG · PNG · PDF, ${LICENSE_MB}MB까지`}
              note={<p className="mj-hint">상호 · 대표자 · 등록번호 글자가 또렷하게 보이게 올려 주세요.</p>}
            />

            <fieldset className="mj-fieldset" aria-describedby={errors.trades ? `${FOCUS.trades}-e` : undefined}>
              <legend className="mj-label">하는 공정 (필수 · 하나 이상)</legend>
              <div className={s.ckg}>
                {TRADES.map((t) => (
                  <label key={t} className={s.ck}>
                    <input id={`v-tr-${t}`} type="checkbox" checked={trades.includes(t)} onChange={(e) => { setTrades((l) => toggle(l, t, e.target.checked)); clear("trades"); }} />
                    {tradeLabel(t)}
                  </label>
                ))}
              </div>
              {err("trades")}
            </fieldset>

            <fieldset className="mj-fieldset" aria-describedby={errors.areas ? `${FOCUS.areas}-e` : undefined}>
              <legend className="mj-label">활동 지역 (필수 · 하나 이상)</legend>
              <div className={`mj-field ${s.narrow}`}>
                <label className="mj-label" htmlFor="v-sido">시 · 도</label>
                <select id="v-sido" className="mj-select" value={sido} onChange={(e) => setSido(e.target.value)}>
                  {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              {region?.groups.map((g) => (
                <div key={g.label || g.prefix} className={s.group}>
                  {g.label ? <p className="mj-small">{g.label}</p> : null}
                  <div className={s.ckg}>
                    {g.items.map((it) => {
                      const key = `${sido}/${it}`;
                      return (
                        <label key={key} className={s.ck}>
                          <input type="checkbox" checked={areas.includes(key)} onChange={(e) => { setAreas((l) => toggle(l, key, e.target.checked)); clear("areas"); }} />
                          {it}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
              {areas.length ? (
                <div className={s.picked}>
                  <p className="mj-small mj-num">고른 지역 {areas.length}곳</p>
                  <ul className={s.chips} aria-label="고른 활동 지역">
                    {areas.map((a) => (
                      <li key={a}>
                        <button type="button" className={s.chip} aria-label={`${areaLabel(regions, a)} 빼기`} onClick={() => setAreas((l) => l.filter((x) => x !== a))}>
                          {areaLabel(regions, a)}
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M3 3l6 6M9 3l-6 6" /></svg>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {err("areas")}
            </fieldset>
          </section>

          <section id="v3" className={s.sec} aria-labelledby="v3-t">
            {head(3, "신청 확인")}
            <dl className={s.sum}>
              <div><dt>상호 · 대표</dt><dd>{[bizName.trim(), owner.trim()].filter(Boolean).join(" · ") || "아직 안 적었어요"}</dd></div>
              <div><dt>사업자등록번호</dt><dd className="mj-num">{(again ? bizNoText(p?.biz_no) : bizNo) || "아직 안 적었어요"}</dd></div>
              <div><dt>서류</dt><dd>{fileText}</dd></div>
              <div><dt>공정</dt><dd>{TRADES.filter((t) => trades.includes(t)).map(tradeLabel).join(" · ") || "아직 안 골랐어요"}</dd></div>
              <div><dt>활동 지역</dt><dd>{areaText || "아직 안 골랐어요"}</dd></div>
              <div><dt>휴대폰</dt><dd className="mj-num">{phone || "아직 안 적었어요"}</dd></div>
            </dl>

            {again ? null : (
              <fieldset className="mj-fieldset">
                <legend className="mj-label">약관 동의</legend>
                <div className={s.agrs}>
                  <div className={s.agrRow}><label className={`${s.agr} ${s.b}`}><input ref={allRef} type="checkbox" checked={allOn} onChange={(e) => setAgreeAll(e.target.checked)} />전체 동의 (선택 포함)</label></div>
                  {AGREE.map((a) => {
                    const ek = a.k === "news" ? null : (a.k as "terms" | "privacy");
                    return (
                      <div key={a.k}>
                        <div className={s.agrRow}>
                          <label className={s.agr}>
                            <input id={a.id} type="checkbox" checked={agree[a.k]} required={!!ek} aria-invalid={ek && errors[ek] ? true : undefined} aria-describedby={ek && errors[ek] ? `${a.id}-e` : undefined} onChange={(e) => { setAgree((x) => ({ ...x, [a.k]: e.target.checked })); if (ek) clear(ek); }} />
                            {a.label}
                          </label>
                          <a className={`mj-lnk ${s.see}`} href={a.href} target="_blank" rel="noopener" aria-label={`${a.see} 보기, 새 창`}>
                            보기<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M5 2H2v8h8V7M7 2h3v3M10 2L5.5 6.5" /></svg>
                          </a>
                        </div>
                        {ek && errors[ek] ? <FieldError id={`${a.id}-e`}>{errors[ek]}</FieldError> : null}
                      </div>
                    );
                  })}
                </div>
              </fieldset>
            )}

            <div className={s.submitRow}>
              <button type="submit" className={`mj-btn mj-btn-pri ${s.submit}`} disabled={busy} aria-describedby="v-send-h">{busy ? "보내는 중이에요" : again ? "다시 신청하기" : "가입 신청하기"}</button>
              <p id="v-send-h" className={`mj-small ${s.sendHint}`}>{again ? "다시 신청하면 업체 홈이 ‘심사 중’으로 돌아가요." : "신청하면 관리자가 서류를 확인해요. 결과는 알림으로 알려 드려요."}</p>
            </div>
            {errors.form ? <div id="v-form-e" tabIndex={-1}><FieldError id="v-form-e-t" alert>{errors.form}</FieldError></div> : null}
          </section>
        </form>
      </div>
    </>
  );
}
