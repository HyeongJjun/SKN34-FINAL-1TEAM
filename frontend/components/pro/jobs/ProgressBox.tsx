"use client";
// 공사 진행 사진(시연 피드백 11-23): 공사 첫날부터 사진 1~5장 · 한 줄을 올리면 고객 재재 화면에 뜨고 알림이 가요.
// → POST /vendor/jobs/{did}/progress(client_key + 멱등 키). 금액 · 날짜는 바꾸지 않아요.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import type { JobV3 } from "@/lib/api/vendor";
import { errorText } from "@/lib/backend/client";
import { dateShort } from "@/lib/format";
import { enc, newKey, send } from "../send";
import { Eyebrow, Group, Pics, Small } from "../ui/parts";
import { PhotoPick, type PickedPhoto } from "./PhotoPick";
import s from "./jobs.module.css";

const photoHref = (did: string, fid: string) => `/api/vendor/jobs/${enc(did)}/photos/${enc(fid)}`;

export function ProgressBox({ job, open }: { job: JobV3; /** 지금 올릴 수 있는지(공사 첫날부터 · 공사 중) */ open: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [note, setNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [key, setKey] = useState(newKey);
  const list = job.progress ?? [];

  async function go() {
    if (busy || uploading) return;
    if (!photos.length) { setErr("사진을 한 장 이상 올려 주세요."); return; }
    setErr(null);
    setBusy(true);
    try {
      await send("POST", `/vendor/jobs/${enc(job.deal_id)}/progress`, { file_ids: photos.map((p) => p.id), note: note.trim() || null, client_key: key }, { idem: key });
      toast.show("진행 사진을 보냈어요. 고객 화면에 바로 보여요.");
      setPhotos([]);
      setNote("");
      setKey(newKey());
      router.refresh();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  if (!open && !list.length) return null;
  return (
    <Group flush>
      <Eyebrow>진행 사진</Eyebrow>
      {open ? (
        <>
          <PhotoPick kind="work_photo" label="오늘 공사 사진" max={5} value={photos} onChange={(v) => { setPhotos(v); setErr(null); }} busy={uploading} setBusy={setUploading} />
          <Field label="한 줄" optional maxLength={100} value={note} placeholder="예: 거실 초배 끝, 내일 정배" onChange={(e) => setNote(e.target.value)} />
          {err ? <p className={s.err} role="alert"><Icon name="error" size={16} />{err}</p> : null}
          <Button variant="secondary" onClick={go} busy={busy || uploading}>{busy ? "보내는 중" : "진행 사진 보내기"}</Button>
          <Small>고객이 &quot;어디까지 됐어요?&quot; 하고 묻기 전에 알 수 있어요.</Small>
        </>
      ) : null}
      {list.map((p) => (
        <div key={p.id}>
          <Small>{dateShort(p.day)}{p.note ? ` · ${p.note}` : ""}</Small>
          <Pics label={`${dateShort(p.day)} 진행 사진`} items={p.photos.map((fid, i) => ({ key: fid, src: photoHref(job.deal_id, fid), alt: `진행 사진 ${i + 1}` }))} />
        </div>
      ))}
    </Group>
  );
}
