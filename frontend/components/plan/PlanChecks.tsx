"use client";
// 공사 전 할 일 체크(C36 · D19): PUT /projects/{id}/checks/{key}. 누르는 즉시 바꾸고, 실패하면 되돌리고 알려요.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { call, errorText } from "@/lib/backend/client";
import s from "./planv3.module.css";

export type Check = { key: string; label: string; done: boolean };
/** 할 일마다 아래 한 줄(9판) */
const SUB: Record<string, string> = { office_report: "엘리베이터 보호 · 공사 안내문" };

export function PlanChecks({ projectId, checks, mock }: { projectId: string; checks: Check[]; mock: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [done, setDone] = useState<Record<string, boolean>>(Object.fromEntries(checks.map((c) => [c.key, c.done])));
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(key: string, v: boolean) {
    setDone((d) => ({ ...d, [key]: v }));
    if (mock) return;
    setBusy(key);
    try {
      await call("PUT", `/projects/${encodeURIComponent(projectId)}/checks/${encodeURIComponent(key)}`, { done: v });
      router.refresh();
    } catch (e) {
      setDone((d) => ({ ...d, [key]: !v }));
      toast.show(errorText(e), { tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  if (!checks.length) return null;
  return (
    <ul className={s.checks}>
      {checks.map((c) => (
        <li key={c.key}>
          <label className={s.check}>
            <input type="checkbox" className={s.ck} checked={done[c.key] ?? false} disabled={busy === c.key} onChange={(e) => void toggle(c.key, e.target.checked)} />
            <span className={s.checkText}><b>{c.label}</b>{SUB[c.key] ? <span>{SUB[c.key]}</span> : null}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}
