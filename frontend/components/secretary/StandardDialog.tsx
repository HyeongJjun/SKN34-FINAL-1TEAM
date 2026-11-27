"use client";
// 표준견적서 창(2026-11-25 사용자 요청): 재재 화면에서 누르면 페이지를 옮기지 않고 바로 가운데 큰 창으로 봐요.
// 큰 합계 + 조건 바꾸기 → 줄 표(공급가 + 부가세) → [예상 공정표] [업체 고르기]. 숫자는 서버 계산 엔진 값 그대로예요.
// 전체 도배는 시장 단가(내 공사 표준견적서 화면과 같은 값), 부분 공사는 공공 기준 표준견적서예요.
import { useId, useRef } from "react";
import { StandardSheet } from "@/components/start/StandardSheet";
import { TradeOrder, TradePartSheets } from "@/components/start/TradeParts";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useModal } from "@/components/ui/useModal";
import { MarketSheet, MarketTotal } from "@/components/v2/market/MarketQuote";
import type { Schemas } from "@/lib/backend/client";
import { won } from "@/lib/format";
import { daysCaption, type StdView } from "@/lib/guest/standard";
import s from "./StandardDialog.module.css";

export type StdData = { view: StdView; market: Schemas["V2MqOut"] | null; /** 공정마다 따로 계산한 표준견적서(공정 탭) */ parts?: Schemas["V2MqPartsOut"] | null };

export function StandardDialog({ open, onClose, data, pid, locked, onEdit, onPlan, trade }: { open: boolean; onClose: () => void; data: StdData; pid: string; locked: boolean; /** 공정 탭에서 열면 그 공정 표준견적서만 */ trade?: "dobae" | "mokgong"; /** 조건 바꾸기 · 예상 공정표를 재재 화면 창으로(옮기지 않아요) */ onEdit: () => void; onPlan: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const h = useModal(ref, open, onClose);
  const change = `/start?edit=${pid}`;
  const { view, market } = data;
  const parts = view.parts ?? [];
  // 공정 탭: 그 공정만 따로 계산한 표준견적서(서버 값 그대로). 공정이 하나거나 값이 없으면 전체 표준견적서
  const all = data.parts && data.parts.parts.length > 1 ? data.parts : null;
  const one = trade && all ? all.parts.find((x) => x.trade === trade) ?? null : null;
  const word = (t: string) => (t === "dobae" ? "도배" : t === "mokgong" ? "목공" : t);
  return (
    <dialog ref={ref} className={s.dlg} aria-labelledby={`${id}-t`} onCancel={h.onCancel} onClick={h.onClick}>
      {open ? (
        <div className={s.card}>
          <div className={s.head}>
            <h2 id={`${id}-t`}>{one ? `${word(one.trade)} 표준견적서` : "표준견적서"}</h2>
            <button type="button" className={s.x} aria-label="닫기" onClick={onClose}><Icon name="close" /></button>
          </div>
          <div className={s.body}>
            {parts.length && !one ? <TradeOrder has={["dobae", ...parts.map((x) => x.trade)]} /> : null}
            {one && all ? (
              <>
                <MarketTotal q={one.quote} changeHref={change} onChange={onEdit} caption={`${word(one.trade)}만 · 부가세 포함`} />
                <p className={s.note}>전체 표준견적서 <b className="mj-num">{won(all.total)}</b>은 공종별 금액을 합친 금액이에요({all.parts.map((x) => `${word(x.trade)} ${won(x.quote.total)}`).join(" + ")}).</p>
                <MarketSheet q={one.quote} />
              </>
            ) : market ? (
              <>
                <MarketTotal q={market} changeHref={change} onChange={onEdit} caption={["부가세 포함", daysCaption(view.days)].filter(Boolean).join(" · ")} />
                <MarketSheet q={market} />
              </>
            ) : (
              <StandardSheet view={view} changeHref={change} onChange={onEdit} />
            )}
            {/* 시장 단가 견적은 목공 줄도 들어 있어요(#207). 시장 단가가 없을 때만 공정별 줄을 따로 */}
            {parts.length && !market ? <TradePartSheets parts={parts} /> : null}
            {locked ? <p className={s.note}>실측을 요청한 뒤라 조건은 잠겼어요. 조건 바꾸기에서 넣은 값만 볼 수 있어요.</p> : null}
          </div>
          <div className={s.actions}>
            {view.scope === "partial" ? null : <Button size="lg" variant="secondary" onClick={onPlan}>예상 공정표</Button>}
            <Button size="lg" onClick={onClose}>업체 고르기</Button>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
