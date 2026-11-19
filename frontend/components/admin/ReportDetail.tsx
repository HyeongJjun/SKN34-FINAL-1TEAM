"use client";
// 신고 · 링크 처리 오른쪽 자세히(A02 a_report): 신고된 메시지는 데이터로만(글자 그대로) 보여요.
// 처리: 경고 · 채팅 쓰기 막기 · 업체 기능 멈추기(새 요청만 · 진행 중인 건도, D26 A) · 링크 숨기기 · 문제없음 → POST /admin/reports/{id}/resolve(멱등 키).
// 처리하면 admin_actions에 남고 신고한 사람 · 상대에게 알림이 가요(서버).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { OptionRow } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import type { AdminReportDetail } from "@/lib/api/admin";
import { errorText } from "@/lib/backend/client";
import { listStamp } from "@/lib/format";
import { enc, newKey, send } from "@/components/pro/send";
import { Eyebrow, Quote, Row, Rows, Small } from "@/components/pro/ui/parts";
import { Segmented } from "@/components/ui/Segmented";
import { REPORT_KIND, REPORT_REASON, RESOLVE_LABEL } from "./text";
import s from "./admin.module.css";

type Act = "warn" | "mute_chat" | "suspend" | "hide_link" | "none";

export function ReportDetail({ r }: { r: AdminReportDetail }) {
  const router = useRouter();
  const toast = useToast();
  const [act, setAct] = useState<Act | null>(null);
  const [scope, setScope] = useState<"suspend_new" | "suspend_all">("suspend_new");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [idem] = useState(newKey);
  const open = r.status === "open";
  const who = r.reporter_label || (r.reporter_role === "vendor" ? "업체" : "고객");
  const acts: { key: Act; label: string }[] = [
    { key: "warn", label: "경고 보내기" },
    ...(r.kind === "chat" ? [{ key: "mute_chat" as Act, label: "채팅 쓰기 막기" }] : []),
    { key: "suspend", label: "업체 기능 멈추기" },
    ...(r.kind === "link" ? [{ key: "hide_link" as Act, label: "링크 숨기기" }] : []),
    { key: "none", label: "문제없음으로 닫기" },
  ];

  async function go() {
    if (busy) return;
    if (!act) { setErr("처리를 하나 골라 주세요."); return; }
    setBusy(true);
    setErr(null);
    try {
      await send("POST", `/admin/reports/${enc(r.id)}/resolve`, { action: act === "suspend" ? scope : act, note: note.trim() || null }, { idem });
      toast.show(`처리하고 기록했어요. 신고한 ${r.reporter_role === "vendor" ? "업체" : "고객"}에게 알림이 가요.`);
      router.refresh();
    } catch (e) {
      setErr(errorText(e));
      setBusy(false);
    }
  }

  return (
    <aside className={s.aside} aria-label="고른 신고 자세히">
      <Badge tone="bad">{REPORT_KIND[r.kind] ?? "그 밖"} 신고</Badge>
      <h2 className={s.at}>{r.vendor_name ?? "업체"} · {REPORT_REASON[r.reason_code] ?? "그 밖"}</h2>
      <Rows label="신고 내용">
        <Row label="신고한 사람" value={who} />
        {r.kind === "chat" ? <Row label="차단" value={r.block ? "고객이 차단함" : "안 함"} /> : null}
        {r.kind === "link" && r.link_url ? <Row label={r.link_label ?? "외부 리뷰 링크"} sub="새 창에서 열려요" href={r.link_url} external /> : null}
      </Rows>
      {r.note ? <><Eyebrow>신고한 사람이 남긴 말</Eyebrow><Quote>{r.note}</Quote></> : null}
      {r.evidence ? <><Eyebrow>신고된 메시지</Eyebrow><Quote>{r.evidence}</Quote></> : null}
      {open ? (
        <>
          <Eyebrow>처리</Eyebrow>
          <div role="radiogroup" aria-label="처리" className={s.opts}>
            {acts.map((a) => <OptionRow key={a.key} selected={act === a.key} onClick={() => { setAct(a.key); setErr(null); }}>{a.label}</OptionRow>)}
          </div>
          {act === "suspend" ? (
            <Segmented legend="멈추는 범위" options={[{ value: "suspend_new", label: "새 요청만" }, { value: "suspend_all", label: "진행 중인 건도" }]} value={scope} onChange={(x) => setScope(x as "suspend_new" | "suspend_all")} />
          ) : null}
          <Small>새 요청만 막고 진행 중인 건은 끝까지 해요 · 상대에게 알림이 가요 · 사기 · 믿집 밖 거래면 진행 중인 건도 닫고 다시 고르기를 안내해요</Small>
          <Field label="처리 메모" optional maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
          <Button size="sm" onClick={go} busy={busy}>{busy ? "보내는 중" : "처리하고 기록"}</Button>
          <Small>처리 결과는 신고한 {r.reporter_role === "vendor" ? "업체" : "고객"}에게 알림으로 가요.</Small>
          {err ? <p className={s.err} role="alert"><Icon name="error" size={16} />{err}</p> : null}
        </>
      ) : (
        <>
          <Eyebrow>처리함</Eyebrow>
          <Rows label="처리 기록">
            {r.history.length ? r.history.map((h) => <Row key={h.id} label={RESOLVE_LABEL[h.action] ?? "처리"} sub={[h.admin_name, h.note].filter(Boolean).join(" · ") || undefined} value={listStamp(h.at)} />)
              : <Row label={r.action ? RESOLVE_LABEL[r.action] ?? "처리" : "처리"} value={r.resolved_at ? listStamp(r.resolved_at) : "—"} />}
          </Rows>
        </>
      )}
    </aside>
  );
}
