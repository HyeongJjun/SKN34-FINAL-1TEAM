"use client";
// 유효기간 지난 견적서 '견적서 다시 요청'(D20 A · CF-39). POST /projects/{id}/visits/{vid}/requote → 업체 알림. 확정은 새 견적서가 온 뒤에 해요.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorText } from "@/lib/backend/client";
import { send } from "@/lib/mock/v3b/client";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import s from "./board.module.css";

export function RequoteButton({ projectId, visitId, vendorName }: { projectId: string; visitId: string; vendorName: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setErr(null);
    try {
      await send("POST", `/projects/${encodeURIComponent(projectId)}/visits/${encodeURIComponent(visitId)}/requote`);
      toast.show(`${vendorName}에 견적서를 다시 요청했어요`);
      router.refresh();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={s.cellStack}>
      <Button variant="weak" size="sm" onClick={go} busy={busy}>{busy ? "보내는 중" : "견적서 다시 요청"}</Button>
      {err ? <p className={s.expired} role="alert"><Icon name="error" size={16} />{err}</p> : null}
    </div>
  );
}
