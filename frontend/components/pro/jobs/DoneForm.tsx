"use client";
// 공사 끝냈어요(V13 v_done): 끝낸 날 · 사진 · 남길 말 → POST /vendor/jobs/{did}/done(멱등 키). 고객이 '공사 끝 확인'을 누르면 리뷰를 쓸 수 있어요.
// 고객이 확인하지 않으면 7일 뒤 저절로 끝나고, 3일 전에 고객에게 알려요(D24). 끝낸 날은 수락한 공사 날 가운데서 골라요.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Main, PageHead } from "@/components/site/Frame";
import { BottomBar } from "@/components/ui/BottomBar";
import { Button } from "@/components/ui/Button";
import { SelectField, TextArea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import type { JobV3 } from "@/lib/api/vendor";
import { errorText } from "@/lib/backend/client";
import { dateLong, won } from "@/lib/format";
import { enc, newKey, send } from "../send";
import { Group, Lead } from "../ui/parts";
import { visitTitle } from "../visit/facts";
import { daysText } from "./days";
import { PhotoPick, type PickedPhoto } from "./PhotoPick";
import s from "./jobs.module.css";

export function DoneForm({ job }: { job: JobV3 }) {
  const router = useRouter();
  const toast = useToast();
  const v = job.visit;
  const days = [...job.work_days].sort();
  const [doneOn, setDoneOn] = useState(days[days.length - 1] ?? "");
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [idem] = useState(newKey);
  const back = `/vendor/jobs/${enc(job.deal_id)}`;

  async function go() {
    if (busy || uploading) return;
    if (!doneOn) { setErr("끝낸 날을 골라 주세요."); return; }
    setBusy(true);
    setErr(null);
    try {
      await send("POST", `/vendor/jobs/${enc(job.deal_id)}/done`, { done_on: doneOn, note: note.trim() || null, photo_file_ids: photos.map((p) => p.id) }, { idem });
      toast.show("공사 끝을 고객에게 알렸어요. 고객이 확인하면 공사가 끝나요.");
      router.push(back);
    } catch (e) {
      setErr(errorText(e));
      setBusy(false);
    }
  }

  return (
    <>
      <Main narrow>
        <PageHead title="공사 끝냈어요" crumbs={[{ label: "작업함", href: "/vendor?tab=jobs" }, { label: visitTitle(v), href: back }, { label: "공사 끝" }]} />
        <Lead title={visitTitle(v)} sub={[days.length ? daysText(days, true) : null, job.grand_total != null ? `합계 ${won(job.grand_total)}` : `확정 ${won(job.quote.total)}`].filter(Boolean).join(" · ")} />
        <Group>
          <SelectField label="끝낸 날" options={days.map((d) => ({ value: d, label: dateLong(d) }))} value={doneOn} onChange={(e) => setDoneOn(e.target.value)} />
          <PhotoPick kind="done_photo" label="끝낸 사진" max={10} value={photos} onChange={setPhotos} busy={uploading} setBusy={setUploading} />
          <TextArea label="남길 말" optional rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
          {err ? <p className={s.err} role="alert"><Icon name="error" size={16} />{err}</p> : null}
        </Group>
      </Main>
      <BottomBar note="고객이 확인하면 공사가 끝나요">
        <Button size="lg" block onClick={go} busy={busy || uploading}>{busy ? "보내는 중" : "고객에게 알리기"}</Button>
      </BottomBar>
    </>
  );
}
