"use client";
// '모두 읽음으로'. 다 읽으면 목록을 다시 읽고, 버튼은 그 자리에 둔 채 누를 수 없게 한다(초점이 사라지지 않게).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { call, errorText } from "@/lib/backend/client";
import s from "./notify.module.css";

export function ReadAllButton({ unread }: { unread: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const off = unread === 0 || busy;

  async function onClick() {
    if (off) return;
    setBusy(true);
    setMsg(null);
    try {
      await call("POST", "/notifications/read-all");
      setMsg({ ok: true, text: "모두 읽음으로 바꿨어요." });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: errorText(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={s.acts}>
      <button type="button" className="mj-btn mj-btn-sec mj-btn-sm" aria-disabled={off ? true : undefined} onClick={onClick}>{busy ? "바꾸는 중…" : "모두 읽음으로"}</button>
      <p role="status" className={msg && !msg.ok ? "mj-error" : "mj-small"}>{msg?.text ?? ""}</p>
    </div>
  );
}
