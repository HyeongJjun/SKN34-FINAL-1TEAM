// 작업함 (시안 WVInbox): 탭(할 일 · 기다림 · 공사 · 끝남) + 고른 탭의 표 + 오른쪽 카드 3개.
// 탭은 주소(?tab=)로 바꾼다. 수는 GET /vendor/visits/summary, 줄은 GET /vendor/visits?tab=.
// 공사 탭은 확정된 공사(GET /vendor/visits?tab=jobs): 확정한 날 · 공사 날짜 · 다음 할 일(기한 · 기한 지남은 API 값).
// 할 일에서 본 요청은 '견적서 올리기', 기다림은 '보낸 견적서 보기'로 실측 견적서 화면에 간다.
// 공사 탭 줄은 공사 날짜 상태(dates_state)에 따라 '공사 날짜 내기' · '날짜 다시 내기' · '요청에 답하기' · '새 날짜 올리기' · '공사 날짜 바꾸기' · '공사 날짜 보기'로 /vendor/jobs/{deal_id}에 간다.
// 고객 확인을 기다리는 추가 금액이 있으면 다음 할 일 아래 '추가 금액 확인 기다림 N건'(extras_pending)을 더한다.
// 공사 끝냈어요: 날짜를 수락한 공사는 '공사 끝냈어요', 고객이 남은 일을 알렸으면 '남은 일 다 했어요'로 공사 날짜 화면의 끝냄 칸에 간다.
// 끝냄 · 고객 확인 기다림(checking) · 남은 일(fixing)은 이 탭에 남고, 고객이 확인해 끝난 공사는 끝남 탭에 간다(끝낸 날 · 연락처 기한은 API 값).
import Link from "next/link";
import type { InboxPage, InboxSummary } from "@/lib/api/visit";
import type { VendorPrices, VendorProfile } from "@/lib/api/vendor";
import { dateSeoul, md } from "@/lib/format";
import { phoneText, tradeLabel } from "@/lib/labels";
import { contactLine, type Method } from "@/components/pro/profile/text";
import { finishHref, goLabel, jobHref, needsAct, span } from "@/components/pro/jobs/text";
import { Alert, Dash, Who } from "./Cells";
import { DeclineButton } from "./DeclineButton";
import { DoneNote } from "./DoneNote";
import { DoneTable } from "./DoneTable";
import { EMPTY, JOB_LABEL, TABS, dayOf, doneNote, pyeongText, stampOf, whoOf, type Row, type Tab } from "./text";
import s from "./inbox.module.css";

type Props = {
  tab: Tab;
  summary: InboxSummary;
  page: InboxPage | null;
  prices: { trade: string; p: VendorPrices | null }[];
  profile: VendorProfile | null;
  /** 프로필을 못 읽었을 때 쓰는 가입 신청의 대표자 · 휴대폰 · 상호 */
  fallback: { owner: string | null; phone: string | null; biz: string | null };
  note: string | null;
};

function TodoRow({ v }: { v: Row }) {
  const call = v.new && !!v.customer;
  return (
    <tr>
      <td className={`mj-num ${s.cx} ${s.day}`}>{dayOf(v.received_at)}</td>
      <th scope="row"><Who v={v} /></th>
      <td className={s.cx}>{v.region}</td>
      <td className="r mj-num">{pyeongText(v.pyeong)}</td>
      <td>
        {v.new && v.customer ? <><span className="mj-st mj-st-now">새 요청 · 연락처 보냄</span><br /><span className={s.b}>고객에게 연락하기</span></>
          : v.new ? <><span className="mj-st mj-st-now">새 요청</span><br /><span className={s.b}>고객이 먼저 연락해요</span><br /><span className="mj-small">고객이 이 요청 번호를 말해요</span></>
          : <span className={s.b}>견적서 올리기</span>}
      </td>
      <td className="r">
        <div className={s.acts}>
          {call ? (
            <Link className={`mj-btn mj-btn-pri mj-btn-sm ${s.go} ${s.goPri}`} href={`/vendor/requests/${v.id}`} aria-label={`${whoOf(v)} 요청 보고 연락하기`}>연락하기</Link>
          ) : !v.new ? (
            <Link className={`mj-btn mj-btn-sec mj-btn-sm ${s.go}`} href={`/vendor/requests/${v.id}/quote`} aria-label={`${whoOf(v)} 실측 견적서 올리기`}>견적서 올리기</Link>
          ) : (
            <Link className={`mj-btn mj-btn-sec mj-btn-sm ${s.go}`} href={`/vendor/requests/${v.id}`} aria-label={`${whoOf(v)} 요청 보기`}>요청 보기</Link>
          )}
          <DeclineButton visitId={v.id} name={v.customer?.name ?? null} code={v.code} />
        </div>
      </td>
    </tr>
  );
}

function WaitRow({ v }: { v: Row }) {
  return (
    <tr>
      <td className={`mj-num ${s.cx} ${s.day}`}>{dayOf(v.received_at)}</td>
      <th scope="row"><Who v={v} /></th>
      <td className={s.cx}>{v.region}</td>
      <td className="r mj-num">{pyeongText(v.pyeong)}</td>
      <td><span className="mj-st mj-st-off"><Dash />실측 견적서 보냄</span><br /><span className="mj-small">고객 결정 기다림</span></td>
      <td className="r mj-num">{v.waiting_days ? `${v.waiting_days}일째` : "오늘"}</td>
      <td className="r">
        <div className={s.acts}>
          <Link className={`mj-btn mj-btn-sec mj-btn-sm ${s.go}`} href={`/vendor/requests/${v.id}/quote`} aria-label={`${whoOf(v)} 보낸 견적서 보기`}>보낸 견적서 보기</Link>
          <Link className={`mj-lnk ${s.go}`} href={`/vendor/requests/${v.id}`} aria-label={`${whoOf(v)} 요청 보기`}>요청 보기</Link>
        </div>
      </td>
    </tr>
  );
}

/** 공사 탭 '다음 할 일': 공사 날짜 상태(API)대로. 날짜를 안 냈으면 기한, 다른 날짜 · 바꾸기 요청이면 고른 시작일 · 답할 기한, 기한이 지났으면 '기한 지남' */
function NextJob({ v }: { v: Row }) {
  const st = v.dates_state;
  if (v.deal_status === "checking") {
    return <><span className="mj-st mj-st-wait"><Dash />{JOB_LABEL.checking}</span><br /><span className="mj-small mj-num">{doneNote(v)}</span></>;
  }
  if (v.deal_status === "fixing") {
    return <><span className="mj-st mj-st-now">{JOB_LABEL.fixing}</span>{v.fixing_note ? <span className={s.say}>&lsquo;{v.fixing_note}&rsquo;</span> : null}</>;
  }
  if (st === "waiting" && v.dates_due_at) {
    return (
      <>
        {v.overdue ? <><span className="mj-st mj-st-bad"><Alert />기한 지남</span><br /></> : null}
        <span className={s.b}>공사 날짜 내기</span><br />
        <span className="mj-small mj-num">{stampOf(v.dates_due_at)}까지{v.overdue ? "였어요" : ""}</span>
      </>
    );
  }
  if (st === "proposed") {
    return <><span className="mj-st mj-st-wait"><Dash />고객 수락 기다림</span><br /><span className="mj-small mj-num">{v.proposed_days ? `낸 지 ${v.proposed_days}일째` : "오늘 냈어요"}</span></>;
  }
  if (st === "requested") {
    return (
      <>
        {v.overdue ? <><span className="mj-st mj-st-bad"><Alert />기한 지남</span><br /></> : null}
        <span className={s.b}>고객이 다른 날짜를 원해요</span><br />
        {v.wish_dates.length ? <><span className="mj-small mj-num">고른 시작일 {v.wish_dates.map(md).join(" · ")}</span><br /></> : null}
        {v.request_due_at ? <span className="mj-small mj-num">{stampOf(v.request_due_at)}까지 답하기{v.overdue ? "였어요" : ""}</span> : null}
      </>
    );
  }
  if (st === "change_requested") {
    return (
      <>
        {v.overdue ? <><span className="mj-st mj-st-bad"><Alert />기한 지남</span><br /></> : null}
        <span className={s.b}>날짜 바꾸기 요청</span><br />
        {v.wish_dates.length ? <><span className="mj-small mj-num">고객이 고른 시작일 {v.wish_dates.map(md).join(" · ")}</span><br /></> : null}
        {v.request_due_at ? <span className="mj-small mj-num">{stampOf(v.request_due_at)}까지{v.overdue ? "였어요" : ""}</span> : null}
      </>
    );
  }
  if (st === "change_proposed") {
    return (
      <>
        <span className="mj-st mj-st-wait"><Dash />새 날짜 수락 기다림</span><br />
        {v.proposed_start && v.proposed_end ? <><span className="mj-small mj-num">새 날짜 {span(v.proposed_start, v.proposed_end)}</span><br /></> : null}
        {v.start_date && v.end_date ? <span className="mj-small mj-num">고객이 수락하기 전까지 {span(v.start_date, v.end_date)} 그대로예요</span> : null}
      </>
    );
  }
  if (v.deal_status === "scheduled" && v.end_date) {
    return <><span className={s.b}>{JOB_LABEL.scheduled}</span><br /><span className="mj-small mj-num">&lsquo;공사 끝냈어요&rsquo;는 마지막 공사일 {md(v.end_date)}부터 눌러져요</span></>;
  }
  return <span className={s.b}>{JOB_LABEL[v.deal_status ?? ""] ?? "공사 진행"}</span>;
}

/** 공사 날짜 칸: 수락한 날짜, 없으면 수락 기다리는 날짜, 없으면 '아직 안 냈어요' */
function JobDates({ v }: { v: Row }) {
  if (v.start_date && v.end_date) return <span className={`mj-num ${s.day}`}>{span(v.start_date, v.end_date)}</span>;
  if (v.proposed_start && v.proposed_end) return <><span className={`mj-num ${s.day}`}>{span(v.proposed_start, v.proposed_end)}</span><br /><span className="mj-small">낸 날짜 · 수락 전</span></>;
  return <span className="mj-sub">아직 안 냈어요</span>;
}

function JobRow({ v }: { v: Row }) {
  const go = goLabel(v.dates_state, v.deal_status);
  return (
    <tr>
      <td className={`mj-num ${s.cx} ${s.day}`}>{v.confirmed_at ? dayOf(v.confirmed_at) : "—"}</td>
      <th scope="row"><Who v={v} /></th>
      <td className={s.cx}>{v.region}</td>
      <td className="r mj-num">{pyeongText(v.pyeong)}</td>
      <td><span className={s.mlab}>공사 날짜 </span><JobDates v={v} /></td>
      <td><NextJob v={v} />{v.extras_pending > 0 ? <><br /><span className="mj-st mj-st-wait mj-num"><Dash />추가 금액 확인 기다림 {v.extras_pending}건</span></> : null}</td>
      <td className="r">
        <div className={`${s.acts} ${s.jobActs}`}>
          {v.deal_id && v.deal_status === "fixing" ? (
            <Link className={`mj-btn mj-btn-pri mj-btn-sm ${s.go} ${s.goPri}`} href={finishHref(v.deal_id)} aria-label={`${whoOf(v)} 남은 일 다 했어요`}>남은 일 다 했어요</Link>
          ) : v.deal_id ? (
            <Link className={`mj-btn ${needsAct(v.dates_state) ? `mj-btn-pri ${s.goPri}` : "mj-btn-sec"} mj-btn-sm ${s.go}`} href={jobHref(v.deal_id, v.dates_state, v.deal_status)} aria-label={`${whoOf(v)} ${go}`}>{go}</Link>
          ) : null}
          {v.deal_id && v.deal_status === "scheduled" ? (
            <Link className={`mj-btn mj-btn-sec mj-btn-sm ${s.go}`} href={finishHref(v.deal_id)} aria-label={`${whoOf(v)} 공사 끝냈어요`}>공사 끝냈어요</Link>
          ) : null}
          <Link className={`mj-lnk ${s.go}`} href={`/vendor/requests/${v.id}`} aria-label={`${whoOf(v)} 요청 보기`}>요청 보기</Link>
        </div>
      </td>
    </tr>
  );
}

function Table({ name, caption, head, children }: { name: string; caption: string; head: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mj-table-box" role="region" tabIndex={0} aria-label={`${name} 표, 옆으로 넘겨 볼 수 있어요`}>
      <table className={`mj-table ${s.dense} ${s.cards}`}>
        <caption className="mj-sr">{caption}</caption>
        <thead><tr>{head}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/** 가견적에 쓸 견적서 한 공정: 파일 수 · 확인한 단가 줄 수 · 확인한 날 */
function PriceLine({ trade, p, many }: { trade: string; p: VendorPrices | null; many: boolean }) {
  const pre = many ? `${tradeLabel(trade)} · ` : "";
  const files = p?.files.length ?? 0;
  const conf = p?.confirmed;
  if (!conf) {
    return (
      <>
        <p className="mj-num">{pre}{files ? `파일 ${files}개 · 확인한 단가 없음` : "올린 견적서가 없어요"}</p>
      </>
    );
  }
  const lines = conf.lines.filter((l) => l.unit_price != null).length;
  return (
    <>
      <p className="mj-num">{pre}파일 {files}개 · 확인한 단가 {lines}줄</p>
      <p className="mj-small mj-num">{conf.confirmed_at ? `${md(dateSeoul(conf.confirmed_at))}에 확인했어요 · ` : ""}고객 목록에 가견적이 보여요</p>
    </>
  );
}

export function Inbox({ tab, summary, page, prices, profile, fallback, note }: Props) {
  const count: Record<Tab, number> = { todo: summary.todo, waiting: summary.waiting, jobs: summary.jobs, done: summary.done };
  const items = page?.items ?? [];
  const label = TABS.find((t) => t.k === tab)?.t ?? "";
  const owner = profile?.owner_name ?? fallback.owner;
  const phone = profile?.phone ?? fallback.phone;
  const way = profile?.contact_method
    ? contactLine(profile.contact_method as Method, profile.call_start?.slice(0, 5) ?? "", profile.call_end?.slice(0, 5) ?? "", profile.visit_fee ?? 0)
    : "실측 방식을 아직 정하지 않았어요.";
  const r = summary.recent;

  let body: React.ReactNode;
  if (!items.length) body = <p className={s.empty}>{EMPTY[tab]}</p>;
  else if (tab === "todo") {
    body = (
      <Table name="할 일" caption={`할 일 ${items.length}건, 새 요청부터`} head={<>
        <th scope="col" className={s.cx}>받은 날</th><th scope="col">고객 · 요청</th><th scope="col" className={s.cx}>지역</th>
        <th scope="col" className="r">평형</th><th scope="col">다음 할 일</th><th scope="col"><span className="mj-sr">행동</span></th>
      </>}>
        {items.map((v) => <TodoRow key={v.id} v={v} />)}
      </Table>
    );
  } else if (tab === "waiting") {
    body = (
      <Table name="기다림" caption={`고객을 기다리는 일 ${items.length}건, 오래 기다린 순서`} head={<>
        <th scope="col" className={s.cx}>받은 날</th><th scope="col">고객</th><th scope="col" className={s.cx}>지역</th>
        <th scope="col" className="r">평형</th><th scope="col">지금</th><th scope="col" className="r">기다린 날</th><th scope="col"><span className="mj-sr">행동</span></th>
      </>}>
        {items.map((v) => <WaitRow key={v.id} v={v} />)}
      </Table>
    );
  } else if (tab === "jobs") {
    body = (
      <Table name="공사" caption={`확정된 공사 ${items.length}건, 최근 확정한 순서`} head={<>
        <th scope="col" className={s.cx}>확정한 날</th><th scope="col">고객</th><th scope="col" className={s.cx}>지역</th>
        <th scope="col" className="r">평형</th><th scope="col">공사 날짜</th><th scope="col">다음 할 일</th><th scope="col"><span className="mj-sr">행동</span></th>
      </>}>
        {items.map((v) => <JobRow key={v.deal_id ?? v.id} v={v} />)}
      </Table>
    );
  } else body = <DoneTable items={items} next={page?.next_before ?? null} total={summary.done} />;

  return (
    <main id="main" className={`mj-wrap ${s.page}`}>
      {note ? <DoneNote text={note} /> : null}
      <h1 className="mj-h1">작업함</h1>

      <div className={s.cols}>
        <div className={s.main}>
          <nav className={`mj-tabs ${s.tabs}`} aria-label="작업함 나누기">
            {TABS.map((t) => (
              <Link key={t.k} href={t.k === "todo" ? "/vendor" : `/vendor?tab=${t.k}`} aria-current={t.k === tab ? "page" : undefined}>
                {t.t} <span className="mj-num">{count[t.k]}</span><span className="mj-sr">건</span>
              </Link>
            ))}
          </nav>
          <section id={tab} aria-labelledby="tab-t" className={s.sec}>
            <h2 id="tab-t" className="mj-sr">{label} {count[tab]}건</h2>
            {body}
          </section>
        </div>

        <aside aria-label="가견적 · 연락처 · 최근 30일" className={s.aside}>
          <section aria-labelledby="price-t" className={`${s.card} ${s.cardFirst}`}>
            <div className={s.cardHead}>
              <h2 id="price-t" className="mj-h3">가견적에 쓸 견적서</h2>
              <Link className="mj-lnk" href="/vendor/profile#prices" aria-label="가견적에 쓸 견적서 고치기">고치기</Link>
            </div>
            {prices.map((x) => <PriceLine key={x.trade} trade={x.trade} p={x.p} many={prices.length > 1} />)}
          </section>

          <section aria-labelledby="tel-t" className={s.card}>
            <div className={s.cardHead}>
              <h2 id="tel-t" className="mj-h3">연락처 · 실측 방식</h2>
              <Link className="mj-lnk" href="/vendor/profile#visit" aria-label="연락처 · 실측 방식 바꾸기">바꾸기</Link>
            </div>
            <p className={`mj-num ${s.telNo}`}>{[owner, phoneText(phone)].filter(Boolean).join(" · ") || "—"}</p>
            <p>{way}</p>
          </section>

          <section aria-labelledby="mon-t" className={s.card}>
            <h2 id="mon-t" className="mj-h3">최근 30일</h2>
            <dl className={`mj-num ${s.kv}`}>
              <div><dt>실측 요청</dt><dd><span className={s.big}>{r.requested}</span>건</dd></div>
              <div><dt>실측 견적서 보냄</dt><dd><span className={s.big}>{r.quoted}</span>건</dd></div>
              <div><dt>확정</dt><dd><span className={s.big}>{r.chosen}</span>건</dd></div>
            </dl>
          </section>
        </aside>
      </div>
    </main>
  );
}
