"use client";
// 추가 금액 올리기(V12 v_extra, D23 A): 항목 · 이유 · 금액 · 부가세 · 사진 → POST /vendor/jobs/{did}/extras(client_key + 멱등 키).
// 고객이 승인 · 거절 · 채팅으로 묻기로 답해요. 승인 전에는 합계에 넣지 않아요.
// 공급가 · 부가세 · 합계는 금액 · 부가세를 고르면 GET /vendor/jobs/{did}/extras/preview(저장 안 함)의 엔진 값으로 보여요(9판 '믿집 계산').
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Main, PageHead } from "@/components/site/Frame";
import { BottomBar } from "@/components/ui/BottomBar";
import { Button } from "@/components/ui/Button";
import { CalcBox } from "@/components/ui/CalcBox";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import type { JobV3 } from "@/lib/api/vendor";
import { call, errorText, type Schemas } from "@/lib/backend/client";
import { won } from "@/lib/format";
import { MOCK } from "@/lib/mock/v3c/mode";
import { enc, newKey, send } from "../send";
import { VAT_MODE_LABEL } from "../text";
import { Group, Lead, Small } from "../ui/parts";
import { Segmented } from "@/components/ui/Segmented";
import { visitTitle } from "../visit/facts";
import { daysText } from "./days";
import { PhotoPick, type PickedPhoto } from "./PhotoPick";
import { AssistBox } from "../assist/AssistBox";
import { parseExtra } from "../assist/parse";
import { dateSeoul, eulReul } from "@/lib/format";
import s from "./jobs.module.css";

type Vat = "included" | "excluded" | "exempt";
const digits = (v: string) => v.replace(/\D/g, "").slice(0, 9);

export function ExtraForm({ job, taxKind }: { job: JobV3; taxKind: string }) {
  const router = useRouter();
  const toast = useToast();
  const v = job.visit;
  const fixed: Vat | null = taxKind === "exempt" ? "exempt" : taxKind === "simplified" ? "included" : null;
  const [title, setTitle] = useState("");
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [vat, setVat] = useState<Vat | null>(fixed);
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<Record<string, string | undefined>>({});
  const [busy, setBusy] = useState(false);
  const [key] = useState(newKey);
  const refs = { title: useRef<HTMLInputElement>(null), reason: useRef<HTMLInputElement>(null), amount: useRef<HTMLInputElement>(null) };
  const back = `/vendor/jobs/${enc(job.deal_id)}`;
  const preview = usePreview(job.deal_id, amount, vat);

  async function go() {
    if (busy || uploading) return;
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = "무엇에 드는 돈인지 적어 주세요. 예: 곰팡이 방지 처리";
    if (!reason.trim()) e.reason = "왜 더 드는지 한 줄로 적어 주세요.";
    if (!amount || Number(amount) <= 0) e.amount = "금액을 원 단위로 넣어 주세요.";
    if (!vat) e.vat = "부가세를 어떻게 적었는지 골라 주세요.";
    setErr(e);
    if (e.title) { refs.title.current?.focus(); return; }
    if (e.reason) { refs.reason.current?.focus(); return; }
    if (e.amount) { refs.amount.current?.focus(); return; }
    if (e.vat) return;
    setBusy(true);
    try {
      await send("POST", `/vendor/jobs/${enc(job.deal_id)}/extras`, { client_key: key, title: title.trim(), reason: reason.trim(), entered_amount: Number(amount), vat_mode: vat, file_ids: photos.map((p) => p.id) }, { idem: key });
      toast.show("추가 금액을 보냈어요. 고객이 답하면 알림으로 알려 드려요.");
      router.push(back);
    } catch (er) {
      setErr({ form: errorText(er) });
      setBusy(false);
    }
  }

  function assist(text: string): string {
    const got = parseExtra(text, dateSeoul(new Date().toISOString()));
    if (got.title) setTitle(got.title);
    if (got.reason) setReason(got.reason);
    if (got.amount) setAmount(String(got.amount).slice(0, 9));
    if (got.vat && !fixed) setVat(got.vat);
    setErr({});
    const said = [got.title ? `항목 '${got.title}'` : null, got.amount ? `금액 ${won(got.amount)}` : null, got.vat && !fixed ? `부가세 ${VAT_MODE_LABEL[got.vat]}` : null, got.reason ? "이유" : null].filter(Boolean);
    return said.length ? `${eulReul(said.join(" · "))} 채웠어요. 사진을 붙이고 보내기는 직접 눌러 주세요.` : "못 읽었어요. 예: 곰팡이 방지 처리 12만 원, 부가세 포함, 벽 안쪽까지 곰팡이가 퍼져서";
  }

  return (
    <>
      <Main narrow>
        <PageHead title="추가 금액 올리기" crumbs={[{ label: "작업함", href: "/vendor?tab=jobs" }, { label: visitTitle(v), href: back }, { label: "추가 금액" }]} />
        <Lead title={`${visitTitle(v)} · 공사 중`} sub={[job.work_days.length ? daysText(job.work_days, true) : null, `확정 ${won(job.quote.total)}`].join(" · ")} />
        <AssistBox hint="항목 · 금액 · 부가세 · 이유를 말로 적으면 칸을 채워요." examples={["곰팡이 방지 처리 12만 원, 부가세 포함, 벽 안쪽까지 곰팡이가 퍼져서"]} onText={assist} />
        <Group>
          {/* CF-65: 칸 이름 '무엇' → '항목' */}
          <Field ref={refs.title} label="항목" maxLength={60} value={title} error={err.title} onChange={(e) => { setTitle(e.target.value); setErr((x) => ({ ...x, title: undefined })); }} />
          <Field ref={refs.reason} label="이유" maxLength={200} value={reason} error={err.reason} onChange={(e) => { setReason(e.target.value); setErr((x) => ({ ...x, reason: undefined })); }} />
          <Field ref={refs.amount} label={taxKind === "simplified" ? "받을 금액" : "금액"} unit="원" num inputMode="numeric" value={amount ? Number(amount).toLocaleString("ko-KR") : ""} error={err.amount} onChange={(e) => { setAmount(digits(e.target.value)); setErr((x) => ({ ...x, amount: undefined })); }} />
          {fixed ? (
            <Small>{fixed === "exempt" ? "면세 업체라 부가세가 없어요." : "간이과세라 부가세를 따로 붙이지 않아요. 적은 금액이 고객이 보는 금액이에요."}</Small>
          ) : (
            <>
              {/* CF-64: 칸 이름 '부가세' + 포함 · 빼고 · 면세 */}
              <Segmented legend="부가세" options={(["included", "excluded", "exempt"] as Vat[]).map((m) => ({ value: m, label: VAT_MODE_LABEL[m] }))} value={vat} onChange={(x) => { setVat(x as Vat); setErr((e) => ({ ...e, vat: undefined })); }} />
              {err.vat ? <p className={s.err} role="alert"><Icon name="error" size={16} />{err.vat}</p> : null}
            </>
          )}
          {preview ? (
            <CalcBox tone="form" lines={[{ terms: [{ n: preview.supply, unit: "원", label: "공급가" }, "+", { n: preview.vat, unit: "원", label: "부가세" }], result: { n: preview.total, unit: "원" } }]} />
          ) : <Small>금액과 부가세를 넣으면 믿집이 공급가 · 부가세 · 합계를 계산해서 보여요.</Small>}
          <PhotoPick kind="work_photo" label="추가 금액 사진" max={5} value={photos} onChange={setPhotos} busy={uploading} setBusy={setUploading} />
          {err.form ? <p className={s.err} role="alert"><Icon name="error" size={16} />{err.form}</p> : null}
        </Group>
      </Main>
      <BottomBar note="고객이 승인하기 전에는 합계에 넣지 않아요 · 거절되면 고쳐서 다시 올려요 · 결제는 믿집 밖에서 해요">
        <Button size="lg" block onClick={go} busy={busy || uploading}>{busy ? "보내는 중" : "고객에게 보내기"}</Button>
      </BottomBar>
    </>
  );
}

/** 보내기 전 미리 보기(엔진 값, 저장하지 않아요). 예시 모드 · 금액 없음 · 부가세 안 고름이면 null */
function usePreview(dealId: string, amount: string, vat: Vat | null): Schemas["ExtraPreviewOut"] | null {
  const [out, setOut] = useState<Schemas["ExtraPreviewOut"] | null>(null);
  const key = amount && Number(amount) > 0 && vat ? `${amount}|${vat}` : "";
  useEffect(() => {
    if (MOCK || !key) { setOut(null); return; }
    const [entered, mode] = key.split("|");
    let live = true;
    const t = setTimeout(() => {
      const qs = new URLSearchParams({ entered_amount: entered, vat_mode: mode });
      call<Schemas["ExtraPreviewOut"]>("GET", `/vendor/jobs/${enc(dealId)}/extras/preview?${qs.toString()}`)
        .then((x) => { if (live) setOut(x); })
        .catch(() => { if (live) setOut(null); });
    }, 300);
    return () => { live = false; clearTimeout(t); };
  }, [dealId, key]);
  return out;
}
