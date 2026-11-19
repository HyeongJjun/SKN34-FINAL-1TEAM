"use client";
// 추가 금액 답(C37 · D23 A): [거절] [승인] + '채팅으로 묻기'. 최신 판에만 답해요(POST …/extras/{eid}/answer {answer}).
// 승인하기 전에는 합계에 넣지 않아요. 묻기면 채팅에 시스템 카드가 생기고(서버) 그 대화로 가요.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorText } from "@/lib/backend/client";
import { send } from "@/lib/mock/v3b/client";
import { BottomBar } from "@/components/ui/BottomBar";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import s from "./v3.module.css";

type Answer = "approve" | "reject" | "ask";

export function ExtraActions({ projectId, dealId, extraId, threadId }: { projectId: string; dealId: string; extraId: string; threadId: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<Answer | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function answer(a: Answer) {
    setBusy(a);
    setErr(null);
    try {
      const path = `/projects/${encodeURIComponent(projectId)}/deals/${encodeURIComponent(dealId)}/extras/${encodeURIComponent(extraId)}/answer`;
      await send("POST", path, { answer: a }, a === "approve" ? { step: "extra_ok" } : a === "ask" ? {} : undefined);
      if (a === "ask") {
        router.push(threadId ? `/chat/${encodeURIComponent(threadId)}` : "/chat");
        return;
      }
      toast.show(a === "approve" ? "추가 금액을 승인했어요" : "추가 금액을 거절했어요");
      router.refresh();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <BottomBar
      note={
        err ? <span className={s.err} role="alert">{err}</span>
          : <Button variant="text" arrow onClick={() => answer("ask")} busy={busy === "ask"}>채팅으로 묻기</Button>
      }
    >
      <Button variant="secondary" size="lg" onClick={() => answer("reject")} busy={busy === "reject"} disabled={busy !== null && busy !== "reject"}>{busy === "reject" ? "보내는 중" : "거절"}</Button>
      <Button size="lg" onClick={() => answer("approve")} busy={busy === "approve"} disabled={busy !== null && busy !== "approve"}>{busy === "approve" ? "보내는 중" : "승인"}</Button>
    </BottomBar>
  );
}
