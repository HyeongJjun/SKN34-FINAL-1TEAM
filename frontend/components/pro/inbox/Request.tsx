// 실측 요청 자세히 (시안 WVInbox '새 실측 요청 · 고객에게 연락하기'와 '연락처를 안 보낸 요청' 메모).
// 고객 연락처는 고객이 이 업체에 보내기로 골랐고 요청이 열려 있을 때만 API가 준다. 닫힌 요청은 어떻게 끝났는지만 보인다.
// 방문 날짜는 믿집이 다루지 않는다. 요청함일 때 '견적서 올리기', 견적서 옴 · 확정일 때 '보낸 견적서 보기'로 실측 견적서 화면에 간다.
// 고객이 확정하면 연락처는 공사가 끝난 날부터 1년까지 보이고, 공사 날짜는 /vendor/jobs/{deal_id}에서 낸다.
// 확정 공사의 deal_id · 공사 날짜 상태는 작업함 공사 탭(GET /vendor/visits?tab=jobs, 확정한 공사만 · 쪽 나눔 없음)에서 이 요청 줄을 찾아 읽는다.
import Link from "next/link";
import type { VendorProfile } from "@/lib/api/vendor";
import { listInbox } from "@/lib/api/visit";
import { datesLine, goLabel, jobHref, needsAct } from "@/components/pro/jobs/text";
import { stampSeoul } from "@/lib/format";
import { CONTACT_LABEL, phoneText, type ContactMethod } from "@/lib/labels";
import { Dash } from "./Cells";
import { CopyPhone } from "./CopyPhone";
import { DeclineButton } from "./DeclineButton";
import { MarkSeen } from "./MarkSeen";
import { endLabel, endNote, isDone, telHref, workText, type Detail } from "./text";
import s from "./inbox.module.css";

function title(v: Detail): string {
  if (isDone(v.status)) return endLabel(v);
  if (v.status === "quoted") return "실측 견적서 보냄 · 고객 결정 기다림";
  if (v.status === "chosen") return "고객이 확정했어요";
  return `${v.new ? "새 실측 요청" : "실측 요청"} · ${v.customer ? "고객에게 연락하기" : "고객이 먼저 연락해요"}`;
}

/** "전화 · 통화 09:00~18:00" (고객이 먼저 연락할 때 어떤 방식으로 오는지) */
function myWay(p: VendorProfile | null): string | null {
  const m = p?.contact_method as ContactMethod | null | undefined;
  if (!m || !(m in CONTACT_LABEL)) return null;
  const st = p?.call_start?.slice(0, 5);
  const en = p?.call_end?.slice(0, 5);
  return [CONTACT_LABEL[m], st && en ? `통화 ${st}~${en}` : null].filter(Boolean).join(" · ");
}

export async function Request({ v, profile }: { v: Detail; profile: VendorProfile | null }) {
  const done = isDone(v.status);
  const job = v.status === "chosen" ? (await listInbox("jobs").catch(() => null))?.items.find((x) => x.id === v.id && x.deal_id) ?? null : null;
  const c = v.customer;
  const way = myWay(profile);
  const here = c ? `${c.name} · ${v.area_name} ${workText(v)} 실측 요청` : `${v.code} 실측 요청`;
  return (
    <>
      {v.new && v.status === "requested" ? <MarkSeen visitId={v.id} /> : null}
      <nav className={`mj-wrap mj-crumb ${s.crumb}`} aria-label="이동 경로">
        <ol>
          <li><Link href="/vendor">작업함</Link><span aria-hidden="true">›</span></li>
          <li><span aria-current="page">{here}</span></li>
        </ol>
      </nav>
      <main id="main" className={`mj-wrap ${s.page} ${s.pageReq}`}>
        <div className={s.headRow}>
          <div className={s.head}>
            <p className="mj-small">실측 요청 <span className={s.code}>{v.code}</span> · {workText(v)}</p>
            <h1 className="mj-h1">{title(v)}</h1>
          </div>
          <p className="mj-small mj-num">{stampSeoul(new Date(v.received_at))} 받음</p>
        </div>

        <section aria-label="요청 내용" className={`${s.req} ${done ? s.reqOff : ""}`}>
          <dl className={s.dl}>
            <div><dt>집</dt><dd className="mj-num">{v.home_text}</dd></div>
            {done ? null : <>
              <div><dt>희망 시기</dt><dd className="mj-num">{v.when_text}</dd></div>
              <div><dt>남긴 말</dt><dd>{v.message ? <>&ldquo;{v.message}&rdquo;</> : "없음"}</dd></div>
            </>}
          </dl>

          {done ? (
            <div className={s.part}>
              <p className="mj-st mj-st-off"><Dash />{endLabel(v)}</p>
              <p className="mj-small mj-num">{endNote(v)}</p>
            </div>
          ) : c ? (
            <div className={s.part}>
              <p className="mj-label">고객이 보낸 연락처</p>
              <p>
                <span className={s.b}>{c.name}</span>
                {c.phone ? <> · <span className={`mj-num ${s.b} ${s.sel}`}>{phoneText(c.phone)}</span></> : null}
                {c.address ? <> · {c.address}</> : null}
              </p>
              {c.phone ? (
                <div className={s.btns}>
                  <a className="mj-btn mj-btn-sec mj-btn-sm" href={telHref(c.phone)} aria-label={`${c.name}에게 전화 걸기`}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" className={s.ico}><path d="M3 1.8h2.2l1 2.7-1.4 1a7 7 0 003.7 3.7l1-1.4 2.7 1v2.2a1 1 0 01-1 1A10.2 10.2 0 012 2.8a1 1 0 011-1z" strokeLinejoin="round" /></svg>
                    전화 걸기
                  </a>
                  <CopyPhone phone={phoneText(c.phone)} name={c.name} />
                </div>
              ) : null}
            </div>
          ) : (
            <div className={s.part}>
              <p className={s.b}>고객이 먼저 연락해요 · 고객이 이 요청 번호를 말해요</p>
              <p>내가 정한 방식{way ? `(${way})` : ""}으로 연락이 와요. 이름 · 휴대폰 · 주소는 고객이 보내기로 골랐을 때만 보여요.</p>
            </div>
          )}

          {v.status === "requested" ? (
            <div className={s.foot}>
              <Link className="mj-btn mj-btn-pri" href={`/vendor/requests/${v.id}/quote`}>견적서 올리기</Link>
              <DeclineButton visitId={v.id} name={c?.name ?? null} code={v.code} />
              <p className="mj-small">방문 날짜는 고객과 직접 정해요. 다녀와서 견적서를 올려요.</p>
            </div>
          ) : v.status === "quoted" ? (
            <div className={s.foot}>
              <Link className="mj-btn mj-btn-sec" href={`/vendor/requests/${v.id}/quote`}>보낸 견적서 보기</Link>
              <p className="mj-small">고객이 확정하기 전까지 다시 올릴 수 있어요.</p>
            </div>
          ) : v.status === "chosen" ? (
            <div className={s.foot}>
              {job?.deal_id ? (
                <Link className={`mj-btn ${needsAct(job.dates_state) ? "mj-btn-pri" : "mj-btn-sec"}`} href={jobHref(job.deal_id, job.dates_state, job.deal_status)}>{goLabel(job.dates_state, job.deal_status)}</Link>
              ) : (
                <Link className="mj-btn mj-btn-pri" href="/vendor?tab=jobs">공사 탭으로 가기</Link>
              )}
              <Link className="mj-btn mj-btn-sec" href={`/vendor/requests/${v.id}/quote`}>확정한 견적서 보기</Link>
              <p className="mj-small mj-num">{job ? `${datesLine(job)} ` : ""}고객이 확정한 견적서는 다시 올릴 수 없어요.{job ? "" : " 공사 날짜는 공사 탭에서 확인해요."}</p>
            </div>
          ) : null}
        </section>
        <p><Link className="mj-lnk" href="/vendor">작업함으로 돌아가기</Link></p>
      </main>
    </>
  );
}
