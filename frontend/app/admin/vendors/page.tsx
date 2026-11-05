import Link from "next/link";
import { getReviewSummary, getVendorApplication, listVendorApplications, type ReviewTab, type VendorApplication } from "@/lib/api/admin";
import { DocViewer } from "@/components/admin/DocViewer";
import { SavedNote } from "@/components/admin/SavedNote";
import { StatusMark, VendorReview } from "@/components/admin/VendorReview";
import { eulReul, stampSeoul } from "@/lib/format";
import { changedText, tradeLabel } from "@/lib/labels";
import s from "./page.module.css";

export const metadata = { title: "업체 심사" };

const TABS: { v: ReviewTab; t: string; count?: "pending" | "needs_info" }[] = [
  { v: "pending", t: "기다림", count: "pending" },
  { v: "needs_info", t: "보완 요청", count: "needs_info" },
  { v: "done", t: "처리함" },
];
const EMPTY: Record<ReviewTab, string> = { pending: "기다리는 신청이 없어요.", needs_info: "보완을 요청한 신청이 없어요.", done: "처리한 신청이 없어요." };
const LIST_LABEL: Record<ReviewTab, string> = { pending: "기다리는 신청", needs_info: "보완 요청한 신청", done: "처리한 신청" };

type Q = { tab: ReviewTab; q?: string; id?: string; saved?: string };
function href(p: Q) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v) qs.set(k, v);
  return `/admin/vendors?${qs.toString()}`;
}
const stamp = (iso: string) => stampSeoul(new Date(iso));

function savedText(v: VendorApplication, next: VendorApplication | undefined): string {
  const name = v.biz_name ?? v.name;
  const when = v.reviewed_at ? ` · ${stamp(v.reviewed_at)}` : "";
  const did = v.status === "approved" ? `${eulReul(name)} 승인했어요` : v.status === "needs_info" ? `${name}에 보완을 요청했어요` : `${name} 가입을 거절했어요`;
  const then = next ? ` 다음 신청 ${eulReul(next.biz_name ?? next.name)} 열었어요.` : " 기다리는 신청이 더 없어요.";
  return `${did}${when}.${then}`;
}

// 업체 심사 (시안 WAdmin): 왼쪽 목록(기다림 · 보완 요청 · 처리함, 찾기) + 가운데 서류 · 값 대조 + 오른쪽 판단.
// 고른 신청은 ?id=, 저장한 뒤에는 ?saved=(방금 정한 신청)로 한 줄을 보인다.
export default async function AdminVendors({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; id?: string; saved?: string }> }) {
  const sp = await searchParams;
  const tab = TABS.find((x) => x.v === sp.tab)?.v ?? "pending";
  const q = (sp.q ?? "").trim().slice(0, 50);
  const [summary, list, saved] = await Promise.all([
    getReviewSummary(),
    listVendorApplications(tab, q),
    sp.saved ? getVendorApplication(sp.saved) : null,
  ]);
  const curId = sp.id ?? list[0]?.user_id;
  const v = curId ? await getVendorApplication(curId) : null;
  const idx = v ? list.findIndex((x) => x.user_id === v.user_id) : -1;
  // 저장하면 이 신청은 목록에서 빠진다: 바로 다음(없으면 바로 앞) 신청을 연다
  const next = idx >= 0 ? list[idx + 1] ?? list[idx - 1] : list.find((x) => x.user_id !== v?.user_id);
  const savedNext = saved ? list.find((x) => x.user_id === sp.id) : undefined;
  const n = summary ?? { pending: 0, needs_info: 0, done: 0 };

  return (
    <main id="main" className="mj-wrap" style={{ maxWidth: 1440 }}>
      <div className={s.head}>
        <h1 className="mj-h1">업체 심사</h1>
      </div>
      {saved && saved.status !== "pending" ? <SavedNote className={`mj-st mj-st-ok ${s.saved}`} text={savedText(saved, savedNext)} /> : null}

      <div className={s.cols}>
        <div className={s.list}>
          <h2 className="mj-sr">심사 목록</h2>
          <nav aria-label="심사 상태" className={s.tabs}>
            {TABS.map((t) => (
              <Link key={t.v} className={s.tab} href={href({ tab: t.v })} aria-current={t.v === tab ? "page" : undefined}>
                {t.t}{t.count ? <span className="mj-num">{n[t.count]}</span> : null}
              </Link>
            ))}
          </nav>
          <form role="search" action="/admin/vendors" method="get" className={s.find}>
            <input type="hidden" name="tab" value={tab} />
            <label htmlFor="q-s" className="mj-label">상호 · 사업자등록번호로 찾기</label>
            <div className={s.findRow}>
              <input className="mj-input" id="q-s" name="q" type="search" autoComplete="off" maxLength={50} defaultValue={q} />
              <button type="submit" className="mj-btn mj-btn-sec">찾기</button>
            </div>
          </form>
          <p className="mj-small">{q ? `‘${q}’ 찾은 결과` : tab === "done" ? "최근에 정한 순" : "오래 기다린 순"} · {list.length}곳</p>
          {list.length ? (
            <ul role="list" aria-label={LIST_LABEL[tab]} className={s.queue}>
              {list.map((x) => {
                const on = x.user_id === v?.user_id;
                const at = x.submitted_at ?? x.created_at;
                return (
                  <li key={x.user_id}>
                    <Link className={s.qi} href={href({ tab, q, id: x.user_id })} aria-current={on ? "true" : undefined}>
                      <span className={s.qTop}>
                        <span className={s.qName}>{x.biz_name ?? x.name}</span>
                        {on ? <span className="mj-st mj-st-now"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="4" fill="currentColor" /></svg>보는 중</span>
                          : tab === "done" ? <StatusMark status={x.status} />
                          : <span className="mj-small mj-num">{x.waiting_days ? `${x.waiting_days}일째` : "오늘"}</span>}
                      </span>
                      <span className="mj-small mj-num">
                        {tab === "done" && x.reviewed_at ? `${stamp(x.reviewed_at)} 정함` : `${stamp(at)} ${x.resubmitted ? "다시 냄" : "신청"}`} · {x.trades.map(tradeLabel).join(" · ")}
                      </span>
                      {x.resubmitted && tab !== "done" ? (
                        <span className={`mj-st mj-st-now ${s.wrap}`}>
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11.5 6.5A4.5 4.5 0 1 0 10 10.2" /><path d="M11.8 3.2v3.3H8.5" /></svg>
                          다시 낸 신청 · 바뀐 칸: {changedText(x.changes)}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : <p className="mj-sub">{q ? "찾는 신청이 없어요." : EMPTY[tab]}</p>}
        </div>

        {v ? (
          <VendorReview
            key={v.user_id}
            v={v}
            viewer={<DocViewer key={v.license_file_id} fileId={v.license_file_id} file={v.license} changedFrom={typeof v.changes?.file === "string" ? v.changes.file : null} />}
            nextHref={href({ tab, q, id: next?.user_id, saved: v.user_id })}
          />
        ) : curId ? (
          <p className={`mj-sub ${s.none}`}>신청을 찾을 수 없어요. 목록에서 다시 골라 주세요.</p>
        ) : null}
      </div>
    </main>
  );
}
