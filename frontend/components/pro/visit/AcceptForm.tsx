"use client";
// 날짜 수락(V06 v_accept): '바로 확정'을 끄고 답한 요청에 고객이 반나절을 골랐어요. 그 반나절은 수락 기한까지 잡아 둬요(D10 A).
// 수락 → POST /vendor/visits/{vid}/accept(멱등 키) → 실측 확정. 다른 날 제안은 ?step=propose(V07).
// 2026-11-25 회의: 고객이 영업일에서 날짜를 골라 요청하면 이 화면으로 와요. 현장 정보(주차 · 엘리베이터)를 보고 수락 · 다른 날 제안 · 못 받아요를 정해요.
// 채팅은 요청 때 이미 열려 있어요.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Main, PageHead } from "@/components/site/Frame";
import { BottomBar } from "@/components/ui/BottomBar";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { BigFigure } from "@/components/ui/Money";
import { useToast } from "@/components/ui/Toast";
import type { VendorVisitV3 } from "@/lib/api/vendor";
import { errorText } from "@/lib/backend/client";
import { dueText, halfDayText } from "@/lib/format";
import { enc, newKey, send } from "../send";
import { LOC_NOTE } from "../text";
import { Notice } from "@/components/ui/Notice";
import { Eyebrow, Group, Small } from "../ui/parts";
import { factLine, siteLine, visitTitle } from "./facts";
import { DeclineSheet } from "./PeriodForm";
import s from "./visit.module.css";

export function AcceptForm({ v, now }: { v: VendorVisitV3; now: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [idem] = useState(newKey);
  const [decline, setDecline] = useState(false);
  const site = siteLine(v);
  const b = v.booked;

  async function accept() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const out = await send<{ thread_id?: string | null }>("POST", `/vendor/visits/${enc(v.id)}/accept`, undefined, { idem });
      toast.show("수락했어요. 실측이 정해졌어요.");
      router.push(out?.thread_id ? `/chat/${enc(out.thread_id)}` : "/vendor?tab=sched");
    } catch (e) {
      setErr(errorText(e));
      setBusy(false);
    }
  }

  return (
    <>
      <Main narrow>
        <PageHead title="날짜 수락" crumbs={[{ label: "작업함", href: "/vendor" }, { label: visitTitle(v) }]} />
        <Group>
          <Eyebrow>{factLine(v)}</Eyebrow>
          {b ? (
            <>
              <BigFigure size="mid" label="고객이 고른 날" caption={null}>{halfDayText(b.day, b.half, true)}</BigFigure>
              {b.hold_until ? <Small red>{dueText(b.hold_until, { now })} 답해요 · 그때까지 이 반나절을 잡아 둬요</Small> : null}
            </>
          ) : <Small>고객이 고른 날을 불러오지 못했어요. 작업함에서 다시 열어 주세요.</Small>}
        </Group>
        <Group>
          <Eyebrow>현장 정보</Eyebrow>
          <Small>{site ?? "고객이 아직 현장 정보를 적지 않았어요. 채팅으로 주차 · 엘리베이터를 물어보세요."}</Small>
        </Group>
        <Notice tone="gray">현장 사정으로 이 날이 어려우면 다른 날을 제안하거나 못 받는다고 알려 주세요. 채팅으로 먼저 물어봐도 돼요. {LOC_NOTE}</Notice>
        {err ? <p className={s.err} role="alert"><Icon name="error" size={16} />{err}</p> : null}
      </Main>
      <BottomBar>
        <Button size="lg" variant="secondary" onClick={() => setDecline(true)} disabled={busy}>못 받아요</Button>
        <Button size="lg" variant="secondary" href={`/vendor/requests/${enc(v.id)}?step=propose`} disabled={busy}>다른 날 제안</Button>
        <Button size="lg" onClick={accept} busy={busy}>{busy ? "보내는 중" : "수락"}</Button>
      </BottomBar>
      <DeclineSheet open={decline} onClose={() => setDecline(false)} visitId={v.id} />
    </>
  );
}
