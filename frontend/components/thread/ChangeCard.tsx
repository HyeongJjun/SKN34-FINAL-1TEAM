"use client";
// 일정 바꾸기 요청 카드(C28 고객 · V20 업체). 채팅의 시스템 글(change_requested, ref_id = 바꾸기 id)이 이 카드로 보여요.
// 고객: 내 쪽 · '12.15(화) 오전 → 12.17(목) 오전' · '마루와벽이 수락하면 바뀌어요'(CF-04) · [요청 취소] + 아래 줄 '수락하기 전까지는 … 그대로예요'.
// 업체: 상대 쪽 · '12.12(토) 14:20까지 답해요'(CF-60) · [다른 날 제안](V07 화면) [수락].
// 업체가 다른 날을 냈으면(countered) 고객이 그중 하나를 골라요. 끝난 요청(수락 · 취소 · 기한 지남)은 흐리게 끝난 말만.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorText, type Schemas } from "@/lib/backend/client";
import { dueText } from "@/lib/format";
import { send } from "@/lib/mock/v3b/client";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { iGa, slotText } from "@/components/visit/text";
import s from "./thread.module.css";

type Change = Schemas["ChangeOut"];

export function ChangeCard({ change, role, projectId, visitId, vendorName }: {
  change: Change;
  role: "customer" | "vendor";
  projectId: string | null;
  visitId: string;
  /** 고객 화면의 업체 상호 */
  vendorName: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const from = slotText({ day: change.from_day, half: change.from_half });
  const to = slotText({ day: change.to_day, half: change.to_half });
  const open = change.status === "open";
  const enc = encodeURIComponent;

  async function run(key: string, method: "POST", path: string, body: unknown, ok: string, mock?: { step: "change" | "both_booked" }) {
    setErr(null);
    setBusy(key);
    try {
      await send(method, path, body, mock ? { step: mock.step } : undefined);
      toast.show(ok);
      router.refresh();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  const done =
    change.status === "accepted" ? `바뀌었어요 · ${to}` :
    change.status === "withdrawn" ? "요청을 취소했어요" :
    change.status === "expired" ? `기한이 지나 ${from} 그대로예요` : null;

  return (
    <div className={open || change.status === "countered" ? s.card : `${s.card} ${s.cardDone}`}>
      <p className={s.cardEb}>일정 바꾸기 요청</p>
      <p className={`${s.cardMain} mj-num`}>{from} → {to}</p>
      {done ? <p className={s.cardSm}>{done}</p> : null}

      {role === "customer" && open ? (
        <>
          <p className={s.cardSm}>{iGa(vendorName)} 수락하면 바뀌어요</p>
          <div>
            <Button variant="text" gray busy={busy === "withdraw"} onClick={() => projectId && run("withdraw", "POST", `/projects/${enc(projectId)}/visits/${enc(visitId)}/changes/${enc(change.id)}/withdraw`, undefined, "일정 바꾸기 요청을 취소했어요", { step: "both_booked" })}>
              {busy === "withdraw" ? "보내는 중" : "요청 취소"}
            </Button>
          </div>
        </>
      ) : null}

      {role === "customer" && change.status === "countered" && change.proposal ? (
        <>
          <p className={s.cardSm}>{iGa(vendorName)} 다른 날을 제안했어요 · 하나를 고르면 바뀌어요</p>
          <div className={s.slots}>
            {change.proposal.slots.map((x) => {
              const k = `${x.day}-${x.half}`;
              return (
                <Button key={k} variant="weak" size="sm" busy={busy === k} onClick={() => projectId && run(k, "POST", `/projects/${enc(projectId)}/visits/${enc(visitId)}/changes/${enc(change.id)}/pick`, { day: x.day, half: x.half }, "실측 일정을 바꿨어요")}>
                  {slotText(x)}
                </Button>
              );
            })}
          </div>
        </>
      ) : null}

      {role === "vendor" && open ? (
        <>
          <p className={s.cardSm}><time dateTime={change.due_at} className="mj-num">{dueText(change.due_at)}</time> 답해요</p>
          <div className={s.cardBtns}>
            <Button variant="secondary" size="sm" href={`/vendor/requests/${enc(visitId)}?step=propose`}>다른 날 제안</Button>
            <Button size="sm" busy={busy === "accept"} onClick={() => run("accept", "POST", `/vendor/visits/${enc(visitId)}/changes/${enc(change.id)}/accept`, undefined, "실측 일정을 바꿨어요")}>
              {busy === "accept" ? "보내는 중" : "수락"}
            </Button>
          </div>
        </>
      ) : null}

      {err ? <p className={s.inputErr} role="alert">{err}</p> : null}
    </div>
  );
}
