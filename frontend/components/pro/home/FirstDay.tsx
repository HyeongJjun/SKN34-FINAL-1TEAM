// 승인 첫날 작업함 (시안 WVFirst): 맨 위 띠 · 처음 할 일 3개 · 빈 요청 안내 · 휴대폰.
// 받은 요청이 아직 없을 때의 승인 첫날 모습. 요청이 생기면 /vendor는 작업함(components/pro/inbox)을 보여 준다.
// 마친 일은 부르는 쪽(app/vendor/page.tsx)이 지금 있는 읽기로 정해 넘긴다.
import Link from "next/link";
import type { VendorApplicationMine } from "@/lib/api/vendor";
import { stampSeoul } from "@/lib/format";
import { phoneText } from "@/lib/labels";
import s from "./home.module.css";

export type FirstDone = { prices: boolean; visit: boolean; area: boolean };

export function FirstDay({ app, done }: { app: VendorApplicationMine; done: FirstDone }) {
  const areas = app.areas.map((a) => a.label).join(" · ");
  const items = [
    { k: "prices", on: done.prices, t: "가견적에 쓸 견적서 올리기", d: "견적서를 근거로 단가를 넣고 확인하면 고객에게 가견적이 보여요.", href: "/vendor/profile#prices", btn: "견적서 올리기", pri: true },
    { k: "visit", on: done.visit, t: "실측 방식 정하기", d: "고객이 실측을 요청하면 어떻게 연락할지 · 통화 시간 · 실측 비용을 정해요.", href: "/vendor/profile#visit", btn: "방식 정하기", pri: false },
    { k: "area", on: done.area, t: "활동 지역 확인", d: `신청할 때 고른 곳이에요${areas ? ` · ${areas}` : ""}`, href: "/vendor/profile#basic", btn: "지역 확인하기", pri: false },
  ];
  const n = items.filter((x) => x.on).length;
  const list = (
    <ol aria-labelledby="first-t" className={s.todo}>
      {items.map((x) => (
        <li key={x.k} className={s.ti}>
          {x.on ? (
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="var(--ok)" strokeWidth="1.8" aria-hidden="true" className={s.ico}><circle cx="11" cy="11" r="9" /><path d="M7 11.3l2.8 2.8 5.2-5.6" /></svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="var(--line-strong)" strokeWidth="1.6" aria-hidden="true" className={s.ico}><circle cx="11" cy="11" r="9" /></svg>
          )}
          <span className={s.tt}>
            <span className={s.b}><span className="mj-sr">{x.on ? "마쳤어요, " : "아직 안 했어요, "}</span>{x.t}</span>
            <span className="mj-small">{x.d}</span>
          </span>
          <Link className={`mj-btn ${x.pri && !x.on ? "mj-btn-pri" : "mj-btn-sec"} mj-btn-sm ${s.tbtn}`} href={x.href}>{x.btn}</Link>
        </li>
      ))}
    </ol>
  );

  return (
    <main id="main" className={`mj-wrap ${s.first}`}>
      <div className={`mj-notice ${s.band}`} role="status">
        <svg width="18" height="18" viewBox="0 0 14 14" fill="none" stroke="var(--ok)" strokeWidth="2" aria-hidden="true" className={s.ico}><path d="M2.5 7.5l3 3 6-7" /></svg>
        <p><b>가입 심사가 끝났어요.</b> 이제 고객 요청을 받을 수 있어요.{app.approved_at ? <> <span className="mj-small mj-num">{stampSeoul(new Date(app.approved_at))} 승인</span></> : null}</p>
      </div>

      <h1 className="mj-h1">작업함</h1>

      <div className={s.cols}>
        <div className={s.main}>
          <section aria-labelledby="first-t" className={s.firstSec}>
            {n === items.length ? (
              <details className={s.fold}>
                <summary><h2 id="first-t" className="mj-h3">처음 할 일을 모두 마쳤어요</h2></summary>
                {list}
              </details>
            ) : (
              <>
                <div className={s.firstHead}>
                  <h2 id="first-t" className="mj-h2">처음 할 일</h2>
                  <p className="mj-small mj-num">{items.length}개 중 {n}개 마쳤어요</p>
                </div>
                {list}
                {done.prices ? null : <p className={`mj-notice ${s.big}`}>견적서를 안 올려도 요청은 받을 수 있어요. 고객 목록에는 &lsquo;가견적 없음 · 실측 뒤 금액&rsquo;으로 보여요.</p>}
              </>
            )}
          </section>

          <section id="todo" aria-labelledby="todo-t" className={s.empty}>
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="var(--line-strong)" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="M6 22l5-13h18l5 13v9H6z" /><path d="M6 22h9l2 4h6l2-4h9" /></svg>
            <h2 id="todo-t" className="mj-h3">아직 받은 요청이 없어요.</h2>
            <p className="mj-small">요청이 오면 여기와 알림에 보여요.</p>
          </section>
        </div>

        <aside aria-label="연락처" className={s.aside}>
          <section aria-labelledby="tel-t" className={s.tel}>
            <h2 id="tel-t" className="mj-h3">휴대폰</h2>
            <div className={s.telRow}>
              <p className={`mj-num ${s.telNo}`}>{[app.owner_name, phoneText(app.phone)].filter(Boolean).join(" · ") || "—"}</p>
              <Link className="mj-lnk" href="/vendor/profile#basic" aria-label="휴대폰 번호 바꾸기">바꾸기</Link>
            </div>
            <p className="mj-small">실측 요청을 보낸 고객에게 보이고, 요청이 닫히면 가려져요. 확정한 고객에게는 공사가 끝난 날부터 1년까지 보여요.</p>
          </section>
        </aside>
      </div>
    </main>
  );
}
