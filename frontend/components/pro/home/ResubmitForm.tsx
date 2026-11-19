"use client";
// 보완해서 다시 보내기(V14 v_needinfo): 관리자가 연 칸만 보여요. 등록증은 고르면 바로 올리고(POST /files kind=license),
// 서버가 사진의 위치 정보를 지운 뒤라 '위치 정보 지움'을 붙여요. '다시 보내기' → POST /vendor/application/resubmit(멱등 키).
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { fileErrorText, isImage, LICENSE_ACCEPT, licenseError } from "@/components/auth/VendorSignupForm.license";
import { Main } from "@/components/site/Frame";
import { BottomBar } from "@/components/ui/BottomBar";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { FileDrop } from "@/components/ui/FileDrop";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { ApiError, errorText, type Schemas } from "@/lib/backend/client";
import { newKey, send, upload } from "../send";
import { FileRow } from "@/components/ui/FileRow";
import { Eyebrow, Group, Small } from "../ui/parts";
import s from "./home.module.css";

type Up = { id: string; name: string; size: number; type: string };
type Key = "biz" | "owner" | "file" | "form";

export function ResubmitForm({ open, openText, bizName, ownerName, head, history }: {
  open: Schemas["OpenFieldOut"][];
  openText: string;
  bizName: string;
  ownerName: string;
  head: ReactNode;
  history: ReactNode;
}) {
  const router = useRouter();
  const toast = useToast();
  const nameF = open.find((o) => o.field === "biz_name");
  const ownerF = open.find((o) => o.field === "owner_name");
  const fileF = open.find((o) => o.field === "license_file_id");
  const [biz, setBiz] = useState(bizName);
  const [owner, setOwner] = useState(ownerName);
  const [file, setFile] = useState<Up | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Partial<Record<Key, string>>>({});
  const [idem] = useState(newKey);
  const refs = { biz: useRef<HTMLInputElement>(null), owner: useRef<HTMLInputElement>(null) };
  const formRef = useRef<HTMLFormElement>(null);

  async function pick(files: File[]) {
    const f = files[0];
    if (!f) return;
    const bad = licenseError(f);
    if (bad) { setErr((e) => ({ ...e, file: bad })); return; }
    setErr((e) => ({ ...e, file: undefined, form: undefined }));
    setUploading(true);
    try {
      const out = await upload("license", f);
      setFile({ id: out.id, name: out.filename, size: out.size, type: out.content_type });
    } catch (e) {
      setErr((x) => ({ ...x, file: fileErrorText(e) ?? errorText(e) }));
    } finally {
      setUploading(false);
    }
  }

  function focusFirst(e: Partial<Record<Key, string>>) {
    if (e.biz) refs.biz.current?.focus();
    else if (e.owner) refs.owner.current?.focus();
    else if (e.file) formRef.current?.querySelector<HTMLInputElement>("input[type=file]")?.focus();
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    if (busy || uploading) return;
    const e: Partial<Record<Key, string>> = {};
    if (nameF && !biz.trim()) e.biz = "상호를 등록증과 같게 적어 주세요.";
    if (ownerF && !owner.trim()) e.owner = "대표자 이름을 등록증과 같게 적어 주세요.";
    if (fileF?.required && !file) e.file = "사업자등록증 파일을 다시 올려 주세요.";
    setErr(e);
    if (Object.keys(e).length) { focusFirst(e); return; }
    setBusy(true);
    try {
      const body: Schemas["ResubmitIn"] = {};
      if (nameF) body.biz_name = biz.trim();
      if (ownerF) body.owner_name = owner.trim();
      if (fileF && file) body.license_file_id = file.id;
      await send("POST", "/vendor/application/resubmit", body, { idem });
      toast.show("다시 보냈어요. 관리자가 확인하면 알림으로 알려 드려요.");
      router.refresh();
    } catch (er) {
      const got: Partial<Record<Key, string>> = {};
      if (er instanceof ApiError && er.fields?.length) {
        for (const f of er.fields) {
          const k: Key = f.loc[0] === "biz_name" ? "biz" : f.loc[0] === "owner_name" ? "owner" : f.loc[0] === "license_file_id" ? "file" : "form";
          got[k] ??= f.msg;
        }
      } else got.form = errorText(er);
      setErr(got);
      focusFirst(got);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Main narrow>
        {head}
        <form id="resubmit" ref={formRef} noValidate onSubmit={submit} className={s.form}>
          <Group>
            <Eyebrow>다시 올릴 것 · {openText}</Eyebrow>
            {nameF ? <Field ref={refs.biz} label="상호" autoComplete="organization" maxLength={100} value={biz} error={err.biz} onChange={(e) => { setBiz(e.target.value); setErr((x) => ({ ...x, biz: undefined })); }} /> : null}
            {ownerF ? <Field ref={refs.owner} label="대표자" autoComplete="name" maxLength={50} value={owner} error={err.owner} onChange={(e) => { setOwner(e.target.value); setErr((x) => ({ ...x, owner: undefined })); }} /> : null}
            {fileF ? (
              <>
                {file ? (
                  <FileRow
                    name={file.name}
                    size={file.size}
                    note={isImage(file.type, file.name) ? "위치 정보 지움" : undefined}
                    action={<Button variant="text" gray onClick={() => setFile(null)} aria-label={`${file.name} 빼기`}>빼기</Button>}
                  />
                ) : null}
                <FileDrop kind="doc" label="사업자등록증 파일 올리기" accept={LICENSE_ACCEPT} multiple={false} types="PDF · 사진" busy={uploading} error={err.file} onFiles={pick} />
              </>
            ) : null}
            <Small>다른 칸은 그대로 두면 돼요.</Small>
            {err.form ? <p className={s.formErr} role="alert"><Icon name="error" size={16} />{err.form}</p> : null}
          </Group>
        </form>
        {history}
      </Main>
      <BottomBar>
        <Button size="lg" block type="submit" form="resubmit" busy={busy || uploading}>{busy ? "보내는 중" : "다시 보내기"}</Button>
      </BottomBar>
    </>
  );
}
