"use client";
// 보완해서 다시 보내기 (시안 WVHome 보완 요청): 관리자가 고른 사유에 열린 칸만 보인다. 열리지 않은 칸은 한 줄로만 알린다.
// 새 등록증은 먼저 POST /files(kind=license)로 올리고, 그 id를 POST /vendor/application/resubmit에 넣는다.
// 다시 보내면 심사 중으로 돌아가고 화면을 새로 읽는다.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FieldError } from "@/components/auth/parts";
import { LICENSE_MB, LicenseField, fileErrorText, licenseError, uploadLicense } from "@/components/auth/VendorSignupForm";
import { ApiError, call, errorText, type Schemas } from "@/lib/backend/client";
import s from "./home.module.css";

type Open = Schemas["OpenFieldOut"];
type Key = "biz" | "owner" | "file" | "form";
const FOCUS: Record<Key, string> = { biz: "re-name", owner: "re-owner", file: "re-file", form: "re-form-e" };

export function ResubmitForm({ open, bizName, ownerName, fileName }: { open: Open[]; bizName: string; ownerName: string; fileName: string | null }) {
  const router = useRouter();
  const nameF = open.find((o) => o.field === "biz_name");
  const ownerF = open.find((o) => o.field === "owner_name");
  const fileF = open.find((o) => o.field === "license_file_id");
  const [biz, setBiz] = useState(bizName);
  const [owner, setOwner] = useState(ownerName);
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Partial<Record<Key, string>>>({});
  const [busy, setBusy] = useState(false);
  const locked = [nameF ? null : "상호", ownerF ? null : "대표자", "사업자등록번호"].filter(Boolean).join(" · ");
  const fileHint = fileF?.required
    ? `상호 · 대표자 · 등록번호 글자가 또렷하게 보이게 다시 올려 주세요. JPG · PNG · PDF, ${LICENSE_MB}MB까지`
    : `${nameF ? "상호가" : ownerF ? "대표자가" : ""} 바뀐 새 등록증이 있으면 올려요. 안 올리면 지금 낸 파일${fileName ? `(${fileName})` : ""}로 다시 봐요. JPG · PNG · PDF, ${LICENSE_MB}MB까지`.trim();

  function clear(k: Key) { if (errors[k] || errors.form) setErrors((e) => ({ ...e, [k]: undefined, form: undefined })); }
  function focusFirst(e: Partial<Record<Key, string>>) {
    const k = (["biz", "owner", "file", "form"] as const).find((x) => e[x]);
    if (k) setTimeout(() => document.getElementById(FOCUS[k])?.focus(), 0);
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (busy) return;
    const e: Partial<Record<Key, string>> = {};
    if (nameF && !biz.trim()) e.biz = "상호를 적어 주세요.";
    if (ownerF && !owner.trim()) e.owner = "대표자 이름을 적어 주세요.";
    if (fileF?.required && !file) e.file = "사업자등록증 파일을 올려 주세요.";
    if (file && licenseError(file)) e.file = licenseError(file) ?? undefined;
    setErrors(e);
    if (Object.keys(e).length) { focusFirst(e); return; }
    setBusy(true);
    try {
      const body: Schemas["ResubmitIn"] = {};
      if (nameF) body.biz_name = biz.trim();
      if (ownerF) body.owner_name = owner.trim();
      if (fileF && file) body.license_file_id = await uploadLicense(file);
      await call("POST", "/vendor/application/resubmit", body);
      router.refresh();
      window.scrollTo({ top: 0 });
    } catch (er) {
      const got: Partial<Record<Key, string>> = {};
      const fm = fileErrorText(er);
      if (fm) got.file = fm;
      else if (er instanceof ApiError && er.fields?.length) {
        for (const f of er.fields) {
          const k: Key = f.loc[0] === "biz_name" ? "biz" : f.loc[0] === "owner_name" ? "owner" : f.loc[0] === "license_file_id" ? "file" : "form";
          if (!got[k]) got[k] = f.msg;
        }
      } else got.form = errorText(er);
      setErrors(got);
      setBusy(false);
      focusFirst(got);
    }
  }

  return (
    <form className={s.fm} noValidate aria-labelledby="st-t" onSubmit={onSubmit}>
      {nameF ? (
        <div className="mj-field">
          <label className="mj-label" htmlFor="re-name">상호 (필수)</label>
          <input id="re-name" className="mj-input" autoComplete="organization" maxLength={100} required value={biz} aria-invalid={errors.biz ? true : undefined} aria-describedby={errors.biz ? "re-name-h re-name-e" : "re-name-h"} onChange={(e) => { setBiz(e.target.value); clear("biz"); }} />
          <p id="re-name-h" className="mj-hint">등록증에 적힌 상호 그대로 넣어요.</p>
          {errors.biz ? <FieldError id="re-name-e">{errors.biz}</FieldError> : null}
        </div>
      ) : null}
      {ownerF ? (
        <div className="mj-field">
          <label className="mj-label" htmlFor="re-owner">대표자 이름 (필수)</label>
          <input id="re-owner" className="mj-input" autoComplete="name" maxLength={50} required value={owner} aria-invalid={errors.owner ? true : undefined} aria-describedby={errors.owner ? "re-owner-h re-owner-e" : "re-owner-h"} onChange={(e) => { setOwner(e.target.value); clear("owner"); }} />
          <p id="re-owner-h" className="mj-hint">등록증에 적힌 대표자 이름 그대로 넣어요.</p>
          {errors.owner ? <FieldError id="re-owner-e">{errors.owner}</FieldError> : null}
        </div>
      ) : null}
      {fileF ? (
        <LicenseField
          id="re-file"
          label={`사업자등록증 다시 올리기 (${fileF.required ? "필수" : "선택"})`}
          file={file}
          onPick={(f) => { const m = licenseError(f); if (m) { setFile(null); setErrors((x) => ({ ...x, file: `${f.name} · ${m}` })); } else { setFile(f); clear("file"); } }}
          onClear={() => { setFile(null); clear("file"); }}
          error={errors.file}
          hint={fileHint}
        />
      ) : null}
      <p className="mj-small">{locked}는 이번에 고칠 수 없어요.</p>
      <div><button type="submit" className="mj-btn mj-btn-pri" disabled={busy}>{busy ? "보내는 중이에요" : "다시 보내기"}</button></div>
      <p className="mj-small">다시 보내면 심사 중으로 돌아가요. 결과는 알림으로 알려 드려요.</p>
      {errors.form ? <div id="re-form-e" tabIndex={-1}><FieldError id="re-form-e-t" alert>{errors.form}</FieldError></div> : null}
    </form>
  );
}
