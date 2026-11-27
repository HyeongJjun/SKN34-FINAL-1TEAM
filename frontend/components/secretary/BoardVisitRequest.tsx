"use client";
// 재재 보드 '실측' 칸에서 바로 실측 요청(2026-11-26 사용자: 요청 화면이 할 게 많고 불편해서 재재 화면 안으로).
// 공정(도배 · 목공)마다 따로 보내요(2026-11-26 팀 피드백 5: 목공을 담아도 도배만 요청되던 것).
// 담은 업체마다 그 업체가 등록한 영업일에서 반나절 하나를 고르면 그 업체에 보내요(안 고른 업체는 이번에 안 보내요).
// POST /projects/{id}/visits {trade, vendor_ids, picks}: 서버가 영업일 · 빈 반나절 · 한 집 같은 반나절(409)을 다시 봐요.
// 현장 정보(주차 · 엘리베이터)는 고르지 않아도 되고, 이 카드 안에서 펼쳐 적어요(SiteInfoCard). 사진은 요청 뒤 업체 채팅으로 보내요.
import { useState } from "react";
import { SiteInfoCard } from "@/components/project/SiteInfoCard";
import { Button } from "@/components/ui/Button";
import { OpenDayPicker, type DayPick } from "@/components/visit/OpenDayPicker";
import type { VisitDraft } from "@/lib/api/visit";
import { call, type Schemas } from "@/lib/backend/client";
import { HALF_LABEL, dateShort, won } from "@/lib/format";
import s from "./flow.module.css";

type Created = Schemas["VisitCreateOut"];
type Act = (key: string, fn: () => Promise<unknown>, said?: string) => Promise<void>;

export function BoardVisitRequest({ pid, trade, draft, today, busy, act }: { pid: string; trade: "dobae" | "mokgong"; draft: VisitDraft; today: string; busy: string | null; act: Act }) {
  const word = trade === "dobae" ? "도배" : "목공";
  const [days, setDays] = useState<Record<string, DayPick | null>>({});
  const [failed, setFailed] = useState<string | null>(null);
  const picks = draft.vendors.flatMap((v) => (days[v.vendor_id] ? [{ vendor_id: v.vendor_id, name: v.name, ...days[v.vendor_id]! }] : []));
  // 같은 반나절에 업체 둘은 안 돼요(서버도 409). 보내기 전에 먼저 알려요
  const halves = picks.map((x) => `${x.day}-${x.half}`);
  const clash = new Set(halves).size !== halves.length;
  const said = picks.map((x) => `${x.name} ${dateShort(x.day)} ${HALF_LABEL[x.half]}`).join(" · ");
  return (
    <div className={s.card}>
      <h4>{word} 실측 날짜 고르고 바로 요청하기</h4>
      <p className={s.note}>업체가 등록해 둔 영업일이에요. 업체마다 반나절 하나를 누르면 그 업체에 보내요. 업체가 현장 사정을 보고 수락하면 확정돼요.</p>
      {draft.vendors.map((v) => (
        <div key={v.vendor_id} className={s.reqVendor}>
          <p className={s.reqHead}><b>{v.name}</b>{v.estimate_total != null ? <span className={s.note}> · 가견적 {won(v.estimate_total)}</span> : null}</p>
          <OpenDayPicker projectId={pid} vendorId={v.vendor_id} name={v.name} today={today}
            value={days[v.vendor_id] ?? null} onChange={(x) => setDays((d) => ({ ...d, [v.vendor_id]: x }))} />
        </div>
      ))}
      {clash ? <p className="mj-error" role="alert">같은 반나절에 업체 둘이 올 수 없어요. 업체마다 다른 반나절을 골라 주세요.</p> : null}
      {failed ? <p className="mj-error" role="alert">{failed}</p> : null}
      <Button size="lg" block disabled={!picks.length || clash} busy={busy === `visit-req-${trade}`}
        onClick={() => act(`visit-req-${trade}`, async () => {
          setFailed(null);
          const out = await call<Created>("POST", `/projects/${pid}/visits`, { trade, vendor_ids: picks.map((x) => x.vendor_id), picks: picks.map(({ vendor_id, day, half }) => ({ vendor_id, day, half })) });
          if (out.failed.length) setFailed(`${out.failed.length}곳에는 보내지 못했어요. 업체 칸에서 다시 확인해 주세요.`);
        }, `${word} 실측을 요청했어요 · ${said}`)}>
        {picks.length ? `${word} ${picks.length}곳에 실측 요청 보내기` : "반나절을 골라 주세요"}
      </Button>
      <details className={s.site}>
        <summary>현장 정보 적기(주차 · 엘리베이터, 안 적어도 돼요)</summary>
        <SiteInfoCard projectId={decodeURIComponent(pid)} />
      </details>
    </div>
  );
}
