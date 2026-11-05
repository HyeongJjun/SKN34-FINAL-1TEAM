// 실측 요청 · 업체 연락 (시안 WVisit): 요청한 업체 카드(연락처 · 연락 방식 버튼 · 요청 취소).
// 믿집은 방문 날짜를 잡지 않는다. 연락처는 API가 공개 규칙을 지난 요청에만 준다(취소함 · 못 받음은 가린다).
// 이 공정을 확정했으면(GET /projects/{id}/deals) 확정 안내를 두고 보낼 문구 · 더 요청하기를 뺀다.
// 닫힌 업체는 닫힌 까닭(close_reason)으로 '다른 업체로 정했어요' · '지난 실측 닫힘'을 나누고, 다시 고르는 중이면 그 안내를 둔다.
import Link from "next/link";
import { notFound } from "next/navigation";
import { DealNote } from "@/components/confirm/DealNote";
import { ReselectNote } from "@/components/confirm/ReselectNote";
import { ProjectCrumb } from "@/components/project/ProjectCrumb";
import { ContactCard } from "@/components/vendors/ContactCard";
import { VTabs } from "@/components/vendors/VTabs";
import { isLive, isReselected, isTrade, type VTrade, type Visit } from "@/components/vendors/text";
import { getMyProject } from "@/lib/api/project";
import { listDeals } from "@/lib/api/schedule";
import { listProjectVisits } from "@/lib/api/visit";
import { projectTitle, tradeLabel } from "@/lib/labels";
import s from "./page.module.css";

export const metadata = { title: "실측 요청 · 업체 연락" };

/** 업체마다 가장 최근 요청 하나 (API는 최근 순). 열린 요청을 앞에 둔다 */
function latest(visits: Visit[], trade: VTrade): Visit[] {
  const seen = new Set<string>();
  const out = visits.filter((v) => {
    if (v.trade !== trade) return false;
    const k = v.vendor_id ?? v.id;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return [...out.filter((v) => isLive(v.status)), ...out.filter((v) => !isLive(v.status))];
}

export default async function VisitsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ trade?: string }> }) {
  const { id } = await params;
  const { trade: asked } = await searchParams;
  const p = await getMyProject(id);
  if (!p) notFound();
  const trades = (["dobae", "mokgong"] as VTrade[]).filter((t) => p.trades[t]);
  if (!trades.length) notFound();
  const trade = isTrade(asked) && trades.includes(asked) ? asked : trades[0];
  const [all, deals] = await Promise.all([listProjectVisits(id), listDeals(id, trade)]);
  if (!all) notFound();
  const deal = deals?.[0] ?? null;

  const counts = Object.fromEntries(trades.map((t) => [t, latest(all.visits, t).length]));
  const rows = latest(all.visits, trade);
  // 방문 날짜를 정할 업체(요청함)가 있고 아직 확정하지 않았을 때만 '먼저 연락해' 안내를 보인다
  const contacting = !deal && rows.some((v) => v.status === "requested");
  const tName = tradeLabel(trade);
  const pickHref = `/projects/${id}/vendors?trade=${trade}`;
  const again = !deal && all.visits.some((v) => v.trade === trade && isReselected(v));

  return (
    <main id="main">
      <ProjectCrumb id={id} title={projectTitle(p.region, trades)} here="실측 요청 · 업체 연락" />
      <div className={`mj-wrap ${s.title}`}>
        <h1 className="mj-h1">실측 요청 · 업체 연락</h1>
        {contacting ? <p className="mj-sub">업체에 먼저 연락해 방문 날짜를 정해 주세요.</p> : null}
      </div>

      <div className={`mj-wrap ${s.layout}`}>
        <div className={s.main}>
          <VTabs base={`/projects/${id}/visits`} trades={trades} current={trade} counts={counts} />
          {deal ? <DealNote d={deal} projectId={id} /> : null}
          {again ? <ReselectNote trade={trade} again={!rows.some((v) => isLive(v.status))} /> : null}

          <section aria-labelledby="vd-t" className={s.sec}>
            <h2 id="vd-t" className="mj-h3">요청한 업체 <span className="mj-num">{rows.length}</span><span className="mj-sr">곳</span></h2>
            {rows.length ? (
              <ul role="list" className={s.cards}>
                {rows.map((v) => (
                  <li key={v.id} className={s.card}>
                    <ContactCard v={v} projectId={id} trade={trade} titled locked={!!deal} until={deal?.visit_id === v.id ? deal.contact_until : null} />
                  </li>
                ))}
              </ul>
            ) : (
              <div className={s.empty}>
                <p>아직 {tName} 실측을 요청한 업체가 없어요.</p>
                <Link className="mj-btn mj-btn-pri" href={pickHref}>업체 고르기</Link>
              </div>
            )}
            {rows.length && !deal && (all.slots_left[trade] ?? 0) > 0 ? (
              <p className="mj-small">{all.slots_left[trade]}곳 더 요청할 수 있어요 · <Link className={`mj-lnk ${s.sm}`} href={pickHref}>다른 업체 담기</Link></p>
            ) : null}
          </section>
        </div>

        <aside className={s.side} aria-label="실측 진행 안내">
          <section aria-labelledby="hw-t" className={s.how}>
            <h2 id="hw-t" className="mj-h3">실측은 이렇게 해요</h2>
            <ol className={s.steps}>
              <li><span className="mj-code">1</span><span>업체가 다녀가서 견적서를 올려요.</span></li>
              <li><span className="mj-code">2</span><span>견적서가 오면 표준견적서와 같이 보고 골라요.</span></li>
            </ol>
          </section>
          <section aria-labelledby="sh-t" className={s.sent}>
            <h2 id="sh-t" className="mj-h3">업체에 간 것</h2>
            <p>요청 번호 · 공정 · 평형 · 지역(구) · 희망 시기 · 빈 집인지 · 남긴 말</p>
            <p className="mj-small">이름 · 휴대폰 · 주소는 보내기로 고른 업체에만 가요. 요청이 닫히면 바로 지워져요.</p>
          </section>
        </aside>
      </div>
    </main>
  );
}
