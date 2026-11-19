"use client";
// 다른 날 제안(V07 v_propose): 이유 + 반나절 1~3개 → POST /vendor/visits/{vid}/propose(멱등 키). 고객 실측 일정 카드가 '다른 날 제안 옴'이 돼요.
// 후보 반나절은 엔진이 고른 것(VendorVisitDetailOut.propose_options)만 보여요. 고객 희망 기간 밖 · 찬 반나절은 서버가 422 · 409로 막아요.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Main, PageHead } from "@/components/site/Frame";
import { BottomBar } from "@/components/ui/BottomBar";
import { Button } from "@/components/ui/Button";
import { ChoiceChips } from "@/components/ui/ChoiceChip";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import type { VendorVisitV3 } from "@/lib/api/vendor";
import { errorText } from "@/lib/backend/client";
import { halfDayText, rangeText } from "@/lib/format";
import { enc, newKey, send } from "../send";
import { PROPOSE_REASONS } from "../text";
import { Group, Lead, Small } from "../ui/parts";
import { occ, visitTitle } from "./facts";
import s from "./visit.module.css";

type Half = "am" | "pm";
const key = (d: string, h: Half) => `${d}|${h}`;

export function ProposeForm({ v }: { v: VendorVisitV3 }) {
  const router = useRouter();
  const toast = useToast();
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [idem] = useState(newKey);
  const chosen = v.booked;

  // 후보 반나절은 엔진이 고른 것(propose_options)만 써요. 화면이 날짜를 늘어놓지 않아요
  const options = v.propose_options;

  async function go() {
    if (busy) return;
    if (!reason) { setErr("제안하는 이유를 골라 주세요."); return; }
    if (reason === "other" && !note.trim()) { setErr("그 밖이면 이유를 한 줄로 적어 주세요."); return; }
    if (!picked.length) { setErr("제안할 반나절을 1개 이상 골라 주세요."); return; }
    setErr(null);
    setBusy(true);
    try {
      const slots = picked.map((k) => { const [day, half] = k.split("|"); return { day, half }; });
      await send("POST", `/vendor/visits/${enc(v.id)}/propose`, { reason_code: reason, note: reason === "other" ? note.trim() : null, slots }, { idem });
      toast.show("다른 날을 제안했어요. 고객이 고르면 알림으로 알려 드려요.");
      router.push("/vendor?tab=waiting");
    } catch (e) {
      setErr(errorText(e));
      setBusy(false);
    }
  }

  return (
    <>
      <Main narrow>
        <PageHead title="다른 날 제안" crumbs={[{ label: "작업함", href: "/vendor" }, { label: visitTitle(v), href: `/vendor/requests/${enc(v.id)}` }, { label: "다른 날 제안" }]} />
        <Lead title={`${visitTitle(v)} · ${occ(v)}`} sub={chosen ? `고객이 고른 날 ${halfDayText(chosen.day, chosen.half)}` : undefined} />
        <Group>
          <ChoiceChips legend="이유" options={PROPOSE_REASONS.map((r) => ({ value: r.key, label: r.label }))} value={reason} onChange={(x) => { setReason(x); setErr(null); }} />
          {reason === "other" ? <Field label="그 밖 이유" maxLength={200} value={note} onChange={(e) => { setNote(e.target.value); setErr(null); }} /> : null}
        </Group>
        <Group>
          <ChoiceChips
            multiple
            legend="제안할 반나절 · 3개까지"
            options={options.map((o) => ({ value: key(o.day, o.half as Half), label: halfDayText(o.day, o.half as Half), disabled: picked.length >= 3 && !picked.includes(key(o.day, o.half as Half)) }))}
            value={picked}
            onChange={(x) => { setPicked(x.slice(0, 3)); setErr(null); }}
          />
          {!options.length ? <Small>고객 희망 기간 안에 제안할 수 있는 반나절이 없어요.</Small> : null}
          {v.wish_start && v.wish_end ? <Small>고객 희망 기간({rangeText(v.wish_start, v.wish_end)}) 안에서 골라요.</Small> : null}
        </Group>
        {err ? <p className={s.err} role="alert"><Icon name="error" size={16} />{err}</p> : null}
      </Main>
      <BottomBar>
        <Button size="lg" block onClick={go} busy={busy}>{busy ? "보내는 중" : picked.length ? `${picked.length}개 제안 보내기` : "제안 보내기"}</Button>
      </BottomBar>
    </>
  );
}
