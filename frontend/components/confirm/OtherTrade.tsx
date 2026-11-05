// 확정 화면 오른쪽 '다른 공정' (시안 WConfirm aside). 다른 공정이 확정됐으면 업체 · 공사 날짜 · 실측 견적, 아니면 비교로 가는 링크.
import Link from "next/link";
import { Check } from "@/components/vendors/icons";
import { eunNeun } from "@/components/vendors/text";
import { won } from "@/lib/format";
import { tradeLabel } from "@/lib/labels";
import { DEAL_LABEL, dates, when, type Deal } from "./text";
import s from "./confirm.module.css";

export function OtherTrade({ projectId, trade, deal }: { projectId: string; trade: string; deal: Deal | null }) {
  const tName = tradeLabel(trade);
  return (
    <section aria-labelledby="other-h" className={s.other}>
      <h2 id="other-h" className="mj-h3">다른 공정</h2>
      {deal ? (
        <>
          <p className={`mj-st mj-st-ok ${s.stBig}`}><Check size={16} />{eunNeun(tName)} 이미 확정했어요</p>
          <dl className={`mj-num ${s.odl}`}>
            <dt>업체</dt><dd>{deal.vendor_name}{deal.owner_name ? ` · 대표 ${deal.owner_name}` : ""}</dd>
            <dt>공사 날짜</dt>
            <dd>
              {dates(deal) ? `${dates(deal)} · ` : ""}{DEAL_LABEL[deal.status] ?? "확정함"}
              {deal.status === "confirmed" ? <> · {when(deal.dates_due_at)}까지{deal.overdue ? <> <span className="mj-st mj-st-bad">기한 지남</span></> : null}</> : null}
            </dd>
            <dt>실측 견적</dt><dd>{won(deal.quote.total)} <span className="mj-sub">낼 금액</span></dd>
          </dl>
          <Link className={`mj-lnk ${s.self}`} href={`/projects/${projectId}/plan`}>공정표 보기</Link>
        </>
      ) : (
        <>
          <p>{eunNeun(tName)} 아직 확정하지 않았어요.</p>
          <Link className={`mj-lnk ${s.self}`} href={`/projects/${projectId}/quotes?trade=${trade}`}>{tName} 실측 견적 비교</Link>
        </>
      )}
    </section>
  );
}
