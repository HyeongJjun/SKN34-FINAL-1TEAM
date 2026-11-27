"use client";
// 공사 날짜 아래 단추 띠(C35): [다른 날짜 요청] [수락]. 수락하면 확정 공정표가 생겨요(POST …/dates/{pid}/accept {seen_version}).
import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorText } from "@/lib/backend/client";
import { send } from "@/lib/mock/v3b/client";
import { BottomBar } from "@/components/ui/BottomBar";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { DateRequestSheet } from "./DateRequestSheet";
import { useScheduleGo } from "./nav";
import s from "./v3.module.css";

export function DatesActions({ projectId, dealId, proposalId, seenVersion, vendorName, requestsLeft, options, today, requestDue = null }: {
  requestDue?: string | null;
  projectId: string;
  dealId: string;
  proposalId: string;
  seenVersion: number;
  vendorName: string;
  requestsLeft: number;
  options: string[];
  today: string;
}) {
  const router = useRouter();
  const go = useScheduleGo();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ask, setAsk] = useState(false);
  const pid = encodeURIComponent(projectId);

  async function accept() {
    setBusy(true);
    setErr(null);
    try {
      await send("POST", `/projects/${pid}/deals/${encodeURIComponent(dealId)}/dates/${encodeURIComponent(proposalId)}/accept`, { seen_version: seenVersion }, { step: "scheduled" });
      toast.show("공사 날짜를 수락했어요");
      // 재재 화면 창 안이면 공정표 창으로 바꿔요(밖으로 나가지 않아요)
      if (go) go({ kind: "plan" });
      else router.push(`/projects/${pid}/plan`);
      router.refresh();
    } catch (e) {
      setErr(errorText(e));
      setBusy(false);
    }
  }

  return (
    <>
      <BottomBar note={err ? <span className={s.err} role="alert">{err}</span> : undefined}>
        <Button variant="secondary" size="lg" onClick={() => setAsk(true)} disabled={busy || requestsLeft <= 0}>다른 날짜 요청</Button>
        <Button size="lg" onClick={accept} busy={busy}>{busy ? "보내는 중" : "수락"}</Button>
      </BottomBar>
      <DateRequestSheet open={ask} onClose={() => setAsk(false)} projectId={projectId} dealId={dealId} vendorName={vendorName} requestsLeft={requestsLeft} requestDue={requestDue} options={options} today={today} />
    </>
  );
}
