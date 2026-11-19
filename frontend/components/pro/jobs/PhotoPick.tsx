"use client";
// 사진 고르기 + 올린 사진 칸(추가 금액 V12 · 공사 끝 V13). 고르면 바로 POST /files(kind)로 올리고(위치 정보는 서버가 지워요),
// 칸에는 내 기기에서 고른 사진을 미리 보여요(브라우저 안 주소, 밖으로 보내지 않아요). 이름표는 순서대로 '사진 1'처럼 붙여요.
import { useEffect, useRef, useState } from "react";
import { FileDrop } from "@/components/ui/FileDrop";
import { errorText } from "@/lib/backend/client";
import { PhotoGrid } from "@/components/ui/PhotoGrid";
import { upload } from "../send";

export type PickedPhoto = { id: string; name: string; url: string };
const IMG = /^image\/(jpeg|png|heic|heif|webp)$/;

export function PhotoPick({ kind, label, max = 10, value, onChange, busy, setBusy }: {
  kind: "work_photo" | "done_photo";
  label: string;
  max?: number;
  value: PickedPhoto[];
  onChange: (v: PickedPhoto[]) => void;
  busy: boolean;
  setBusy: (b: boolean) => void;
}) {
  const [err, setErr] = useState<string | null>(null);
  const urls = useRef<string[]>([]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);
  async function pick(files: File[]) {
    const room = max - value.length;
    if (room <= 0) { setErr(`사진은 ${max}장까지 올릴 수 있어요.`); return; }
    const bad = files.find((f) => f.type && !IMG.test(f.type));
    if (bad) { setErr(`${bad.name} · 사진(JPG · PNG)만 올릴 수 있어요.`); return; }
    setErr(null);
    setBusy(true);
    const got: PickedPhoto[] = [];
    try {
      for (const f of files.slice(0, room)) {
        const o = await upload(kind, f);
        const url = URL.createObjectURL(f);
        urls.current.push(url);
        got.push({ id: o.id, name: o.filename, url });
      }
    } catch (e) {
      setErr(errorText(e));
    } finally {
      onChange([...value, ...got]);
      setBusy(false);
    }
  }
  return (
    <>
      {value.length ? (
        <PhotoGrid
          label={label}
          photos={value.map((p, i) => ({ key: p.id, src: p.url, label: `사진 ${i + 1}`, alt: `${label} ${i + 1}` }))}
          onRemove={(key) => onChange(value.filter((x) => x.id !== key))}
        />
      ) : null}
      <FileDrop kind="photo" label={label} accept="image/jpeg,image/png,image/heic,image/webp" busy={busy} error={err} onFiles={pick} />
    </>
  );
}
