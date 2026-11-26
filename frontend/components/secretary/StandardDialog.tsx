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
import { daysCaption, type StdView } from "@/lib/guest/standard";
import s from "./StandardDialog.module.css";

export type StdData = { view: StdView; market: Schemas["V2MqOut"] | null };

export function StandardDialog({ open, onClose, data, pid, locked, onEdit, onPlan }: { open: boolean; onClose: () => void; data: StdData; pid: string; locked: boolean; /** 조건 바꾸기 · 예상 공정표를 재재 화면 창으로(옮기지 않아요) */ onEdit: () => void; onPlan: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const h = useModal(ref, open, onClose);
  const base = `/projects/${pid}`;
  const change = `/start?edit=${pid}`;
  const { view, market } = data;
  const parts = view.parts ?? [];
  return (
    <dialog ref={ref} className={s.dlg} aria-labelledby={`${id}-t`} onCancel={h.onCancel} onClick={h.onClick}>
      {open ? (
        <div className={s.card}>
          <div className={s.head}>
            <h2 id={`${id}-t`}>표준견적서</h2>
            <button type="button" className={s.x} aria-label="닫기" onClick={onClose}><Icon name="close" /></button>
          </div>
          <div className={s.body}>
            {parts.length ? <TradeOrder has={["dobae", ...parts.map((x) => x.trade)]} /> : null}
            {market ? (
              <>
                <MarketTotal q={market} changeHref={change} onChange={onEdit} caption={["부가세 포함", daysCaption(view.days)].filter(Boolean).join(" · ")} />
                <MarketSheet q={market} />
              </>
            ) : (
              <StandardSheet view={view} changeHref={change} onChange={onEdit} />
            )}
            {parts.length ? <TradePartSheets parts={parts} /> : null}
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
