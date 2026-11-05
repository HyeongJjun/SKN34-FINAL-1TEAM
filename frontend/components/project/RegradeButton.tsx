"use client";
// '도배 저가형으로 다시 계산하기' (시안 WStandard 예산 넘음). 집 정보는 그대로 두고 도배 유형만 저가형으로 바꿔 저장한다(PATCH).
// 저장하면 표준견적서는 서버가 새 버전으로 다시 계산한다.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FieldError } from "@/components/auth/parts";
import { bodyOf } from "@/components/start/body";
import type { ApiProject } from "@/lib/api/project";
import { call, errorText } from "@/lib/backend/client";

export function RegradeButton({ p }: { p: ApiProject }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function go() {
    const b = bodyOf(p);
    if (!b.trades.dobae || busy) return;
    setBusy(true);
    setError("");
    try {
      await call("PATCH", `/projects/${p.id}`, { ...b, trades: { ...b.trades, dobae: { ...b.trades.dobae, grade: "economy" } } });
      router.replace(`/projects/${p.id}/standard?done=economy`);
      router.refresh();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" className="mj-lnk" onClick={go} disabled={busy} aria-describedby={error ? "rg-err" : undefined}>
        {busy ? "다시 계산하고 있어요…" : "도배 저가형으로 다시 계산하기"}
      </button>
      {error ? <FieldError id="rg-err">{error}</FieldError> : null}
    </div>
  );
}
