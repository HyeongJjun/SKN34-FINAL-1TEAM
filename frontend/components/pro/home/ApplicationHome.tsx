// 승인 전 업체 홈 (시안 WVHome): 심사 중 · 보완 요청 · 거절 세 모습. 메뉴는 머리에서 잠근다(HeaderBar).
// 보완 요청이면 관리자가 고른 사유에 열린 칸만 고쳐 다시 보낸다(ResubmitForm). 거절이면 다시 신청한다(/signup/vendor?again=1).
import Link from "next/link";
import type { VendorApplicationMine } from "@/lib/api/vendor";
import { stampSeoul } from "@/lib/format";
import { bizNoText, needsInfoTitle, reasonLabel } from "@/lib/labels";
import { ResubmitForm } from "./ResubmitForm";
import s from "./home.module.css";

const stamp = (iso: string) => stampSeoul(new Date(iso));

function Said({ note }: { note: string | null | undefined }) {
  if (!note) return null;
  return (
    <figure className={s.say}>
      <figcaption className="mj-small">관리자가 남긴 말</figcaption>
      <blockquote>{note}</blockquote>
    </figure>
  );
}

function Pending({ app }: { app: VendorApplicationMine }) {
  return (
    <>
      <p className="mj-st mj-st-wait"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="7" cy="7" r="5.5" /><path d="M7 4v3.2l2 1.3" /></svg>심사 중</p>
      <h2 id="st-t" className="mj-h2">신청서를 확인하고 있어요</h2>
      <p className="mj-sub">관리자가 사업자등록증과 신청 내용을 맞춰 봐요. 보통 1~2일 걸려요.</p>
      <ol className={s.steps} aria-label="심사 단계">
        <li>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="var(--ok)" strokeWidth="1.6" aria-hidden="true"><circle cx="9" cy="9" r="7" /><path d="M5.8 9.2l2.2 2.2 4.2-4.6" /></svg>
          <span className={s.b}>신청함</span>{app.applied_at ? <span className="mj-small mj-num">{stamp(app.applied_at)}</span> : null}
        </li>
        <li aria-current="step" className={s.now}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="9" cy="9" r="7" /><path d="M9 2a7 7 0 0 1 0 14z" fill="currentColor" stroke="none" /></svg>
          <span className={s.b}>관리자 확인</span><span className="mj-small">지금 단계</span>
        </li>
        <li>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="var(--ink-sub)" strokeWidth="1.6" aria-hidden="true"><circle cx="9" cy="9" r="7" strokeDasharray="2.5 2.5" /></svg>
          <span className={s.b}>승인</span><span className="mj-small">작업함이 열려요</span>
        </li>
      </ol>
      <dl className={s.sum}>
        <div><dt>상호</dt><dd>{app.biz_name ?? "—"}</dd></div>
        <div><dt>대표자</dt><dd>{app.owner_name ?? "—"}</dd></div>
        <div><dt>사업자등록번호</dt><dd className="mj-num">{bizNoText(app.biz_no) || "—"}</dd></div>
        <div><dt>사업자등록증</dt><dd className={s.file}>{app.license?.filename ?? "—"}</dd></div>
      </dl>
      <p className="mj-small">심사 중에는 신청 내용을 고칠 수 없어요.</p>
    </>
  );
}

function NeedsInfo({ app }: { app: VendorApplicationMine }) {
  const d = app.decision;
  const why = d ? reasonLabel("needs_info", d.code) : null;
  return (
    <>
      <div className="mj-notice mj-notice-warn" role="status">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="var(--warn)" strokeWidth="1.6" aria-hidden="true" className={s.ico}><path d="M9 2.5l7 12.5H2z" strokeLinejoin="round" /><path d="M9 7.5v3.5" strokeLinecap="round" /><path d="M9 13.2v.3" strokeLinecap="round" strokeWidth="2" /></svg>
        <p>{d ? <b className="mj-num">{stamp(d.at)}</b> : null} 관리자가 보완을 요청했어요.</p>
      </div>
      <h2 id="st-t" className="mj-h2">{needsInfoTitle(d?.code)}</h2>
      {why ? <p className={s.m}>사유: {why}</p> : null}
      <Said note={d?.note} />
      <ResubmitForm open={app.open_fields} bizName={app.biz_name ?? ""} ownerName={app.owner_name ?? ""} fileName={app.license?.filename ?? null} />
    </>
  );
}

function Rejected({ app }: { app: VendorApplicationMine }) {
  const d = app.decision;
  const why = d ? reasonLabel("reject", d.code) : null;
  return (
    <>
      <div className="mj-notice mj-notice-bad" role="status">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="var(--danger)" strokeWidth="1.6" aria-hidden="true" className={s.ico}><circle cx="9" cy="9" r="7" /><path d="M6.4 6.4l5.2 5.2M11.6 6.4l-5.2 5.2" /></svg>
        <p>{d ? <b className="mj-num">{stamp(d.at)}</b> : null} 관리자가 이번 신청을 거절했어요.</p>
      </div>
      <h2 id="st-t" className="mj-h2">이번 신청은 받지 않았어요</h2>
      {why ? <p className={s.m}>사유: {why}</p> : null}
      <Said note={d?.note} />
      <p className="mj-sub">같은 사업자등록번호로 다시 신청할 수 있어요. 결정에 대해 묻고 싶으면 고객센터로 문의해 주세요.</p>
      <div><Link className="mj-btn mj-btn-pri" href="/signup/vendor?again=1">다시 신청하기</Link></div>
    </>
  );
}

export function ApplicationHome({ app }: { app: VendorApplicationMine }) {
  return (
    <main id="main">
      <section className={`mj-wrap ${s.top}`} aria-labelledby="pg-t">
        <h1 id="pg-t" className="mj-h1">{app.biz_name ?? "업체"} 가입 심사</h1>
        <p className="mj-sub mj-num">대표 {app.owner_name ?? "—"}{app.applied_at ? ` · ${stamp(app.applied_at)} 신청` : ""}</p>
      </section>
      <section className="mj-wrap" aria-labelledby="st-t">
        <div className={s.body}>
          {app.status === "needs_info" ? <NeedsInfo app={app} /> : app.status === "rejected" ? <Rejected app={app} /> : <Pending app={app} />}
        </div>
      </section>
    </main>
  );
}
