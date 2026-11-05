"use client";
// 업체 심사 판단 (시안 WAdmin): 가운데 열(신청 머리 · 서류 · 값 대조)과 오른쪽 열(판단, 또는 결정 · 처리 기록).
// 값 대조의 '등록증에서 읽은 값'은 관리자가 서류를 보고 적는 칸이라 저장하지 않는다(개업일만 결정과 함께 보낸다).
// 승인은 확인 3개를 모두 체크해야 고를 수 있다. 거절은 확인 창을 한 번 더 띄운다.
// 저장하면 목록의 다음 신청을 연다(nextHref). 다른 관리자가 먼저 정했으면(409) 서버 문장을 그대로 보인다.
// 심사 중이 아닌 신청(보완 요청 · 처리함)은 판단 칸 대신 결정과 처리 기록만 보인다.
import { useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { FieldError } from "@/components/auth/parts";
import { ApiError, call, errorText, type Schemas } from "@/lib/backend/client";
import { dotDate, stampSeoul } from "@/lib/format";
import {
  NEEDS_INFO_REASONS, REJECT_REASONS, REVIEW_ACTION_LABEL, VENDOR_STATUS_LABEL,
  bizNoText, changedText, needsInfoOpenText, needsInfoTitle, reasonLabel, tradeLabel,
} from "@/lib/labels";
import s from "./VendorReview.module.css";

type Detail = Schemas["VendorAdminDetailOut"];
type Review = Schemas["ReviewOut"];
type Decision = "" | "approve" | "needs_info" | "reject";
type Read = { biz_name: string; owner_name: string; biz_no: string; opened_on: string; kind: string };
type Key = "decision" | "code" | "note" | "opened" | "form";
type Errs = Partial<Record<Key, string>>;

const NOTE_MAX = 300;
const DECIDED = ["approve", "needs_info", "reject"];
const BY_VENDOR = ["apply", "resubmit", "reapply"];
const FOCUS: Record<Exclude<Key, "form">, string> = { decision: "dc-first", code: "rs-t", note: "rs", opened: "rd-open" };

const stamp = (iso: string) => stampSeoul(new Date(iso));
const norm = (x: string) => x.replace(/\s+/g, "").toLowerCase();
const onlyDigits = (x: string) => x.replace(/\D/g, "");
const tradesText = (t: string[]) => t.map(tradeLabel).join(" · ") || "없음";

/** 관리자가 적은 개업일 "2024.03.04" · "2024-03-04" · "20240304" → "2024-03-04". 날짜가 아니면 null */
function parseDay(x: string): string | null {
  const m = /^(\d{4})[.\-/\s]*(\d{1,2})[.\-/\s]*(\d{1,2})\.?$/.exec(x.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(Date.UTC(y, mo - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return null;
  return `${m[1]}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function Mark({ k }: { k: "ok" | "bad" | "wait" | "off" | "clock" | "ask" }) {
  const p = { width: 14, height: 14, viewBox: "0 0 14 14", fill: "none", stroke: "currentColor", "aria-hidden": true } as const;
  if (k === "ok") return <svg {...p} strokeWidth="2"><path d="M2.5 7.5l3 3 6-7" /></svg>;
  if (k === "bad") return <svg {...p} strokeWidth="2" strokeLinecap="round"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7" /></svg>;
  if (k === "off") return <svg {...p} strokeWidth="2"><path d="M3 7h8" /></svg>;
  if (k === "clock") return <svg {...p} strokeWidth="1.6"><circle cx="7" cy="7" r="5.5" /><path d="M7 4v3.2l2 1.3" /></svg>;
  return <svg {...p} strokeWidth="1.6" strokeLinecap="round"><circle cx="7" cy="7" r="5.5" /><path d="M5.4 5.5a1.7 1.7 0 1 1 2.4 1.5c-.5.3-.8.6-.8 1.2" /><path d="M7 10.2v.1" /></svg>;
}

const STATUS_MARK: Record<string, { cls: string; k: "ok" | "bad" | "clock" }> = {
  pending: { cls: "mj-st-wait", k: "clock" }, needs_info: { cls: "mj-st-wait", k: "clock" },
  approved: { cls: "mj-st-ok", k: "ok" }, rejected: { cls: "mj-st-bad", k: "bad" },
};
export function StatusMark({ status }: { status: string }) {
  const m = STATUS_MARK[status] ?? STATUS_MARK.pending;
  return <span className={`mj-st ${m.cls}`}><Mark k={m.k} />{VENDOR_STATUS_LABEL[status] ?? "확인 중"}</span>;
}

/** 처리 기록 '한 일' 한 줄 */
function actText(r: Review): string {
  const parts = [REVIEW_ACTION_LABEL[r.action] ?? "기록", reasonLabel(r.action, r.code)];
  if (r.action === "resubmit" || r.action === "reapply") parts.push(`바뀐 칸: ${changedText(r.changes)}`);
  return parts.filter(Boolean).join(" · ");
}

function Log({ v, name }: { v: Detail; name: string }) {
  return (
    <div className={s.log}>
      <h3 className={s.logH}>처리 기록</h3>
      <div className="mj-table-box" role="region" tabIndex={0} aria-label={`${name} 처리 기록 표, 옆으로 넘겨 볼 수 있어요`}>
        <table className={`mj-table ${s.logT}`}>
          <caption className="mj-sr">{name} 처리 기록</caption>
          <thead><tr><th scope="col">시각</th><th scope="col">관리자</th><th scope="col">한 일</th></tr></thead>
          <tbody>
            {v.reviews.map((r) => (
              <tr key={r.id}>
                <td className="mj-num">{stamp(r.at)}</td>
                <td>{BY_VENDOR.includes(r.action) ? <><span aria-hidden="true">—</span><span className="mj-sr">업체</span></> : r.by_name ?? "관리자"}</td>
                <td>{actText(r)}{r.note ? <span className={`mj-small ${s.block}`}>{r.note}</span> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function VendorReview({ v, viewer, nextHref }: { v: Detail; viewer: ReactNode; nextHref: string }) {
  const router = useRouter();
  const decide = v.status === "pending";
  const name = v.biz_name ?? v.name;
  const ch = (v.changes ?? {}) as Record<string, unknown>;
  const [read, setRead] = useState<Read>({ biz_name: "", owner_name: "", biz_no: "", opened_on: v.opened_on ? dotDate(v.opened_on) : "", kind: "" });
  const [checks, setChecks] = useState({ name: false, owner: false, biz: false });
  const [decision, setDecision] = useState<Decision>("");
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Errs>({});
  const [taken, setTaken] = useState("");
  const [busy, setBusy] = useState(false);
  const dlg = useRef<HTMLDialogElement>(null);
  const saveBtn = useRef<HTMLButtonElement>(null);

  const allChecked = checks.name && checks.owner && checks.biz;
  const reasons = decision === "needs_info" ? NEEDS_INFO_REASONS : decision === "reject" ? REJECT_REASONS : [];
  const noteOn = decision === "needs_info" || decision === "reject";
  const noteNeed = noteOn && code === "other";
  const lastSubmit = v.reviews.find((r) => BY_VENDOR.includes(r.action));
  const submitWord = lastSubmit?.action === "resubmit" ? "보완해서 다시 보냄" : lastSubmit?.action === "reapply" ? "다시 신청" : "신청";

  function clearErr(k: Key) { if (errors[k] || errors.form) setErrors((e) => ({ ...e, [k]: undefined, form: undefined })); }
  function setCheck(k: keyof typeof checks, on: boolean) {
    setChecks((c) => ({ ...c, [k]: on }));
    if (!on && decision === "approve") setDecision(""); // 확인이 빠지면 승인을 고를 수 없다
  }
  function pick(d: Decision) {
    setDecision(d);
    setCode(d === "needs_info" ? NEEDS_INFO_REASONS[0].key : d === "reject" ? REJECT_REASONS[0].key : "");
    setErrors({});
  }

  function check(): Errs {
    const e: Errs = {};
    if (!decision) e.decision = "결정을 골라 주세요.";
    else if (decision === "approve" && !allChecked) e.decision = "확인 3개를 모두 체크해야 승인할 수 있어요.";
    if (noteOn && !code) e.code = "사유를 골라 주세요.";
    if (noteNeed && !note.trim()) e.note = "업체에 보낼 말을 적어 주세요.";
    if (read.opened_on.trim() && !parseDay(read.opened_on)) e.opened = "개업일을 2024.03.04처럼 적어 주세요.";
    return e;
  }
  function focusFirst(e: Errs) {
    const k = (["opened", "decision", "code", "note"] as const).find((x) => e[x]);
    setTimeout(() => document.getElementById(k ? FOCUS[k] : "sv-e")?.focus(), 0);
  }

  function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (busy) return;
    const e = check();
    setErrors(e);
    if (Object.keys(e).length) { focusFirst(e); return; }
    if (decision === "reject") { dlg.current?.showModal(); return; }
    void save();
  }

  async function save() {
    setBusy(true);
    setTaken("");
    const opened = read.opened_on.trim() ? parseDay(read.opened_on) : null;
    const body: Schemas["ReviewIn"] = { action: decision as "approve" | "needs_info" | "reject" };
    if (decision !== "approve") { body.code = code; if (note.trim()) body.note = note.trim(); }
    if (opened) body.opened_on = opened;
    try {
      await call("POST", `/admin/vendors/${v.user_id}/review`, body);
      router.push(nextHref);
      router.refresh();
    } catch (er) {
      setBusy(false);
      if (er instanceof ApiError && er.status === 409) {
        setTaken(er.message);
        setTimeout(() => document.getElementById("dc-taken")?.focus(), 0);
        return;
      }
      const got: Errs = {};
      if (er instanceof ApiError && er.code === "opened_on") got.opened = er.message;
      else if (er instanceof ApiError && er.fields?.length) {
        for (const f of er.fields) {
          const k: Key = f.loc[0] === "opened_on" ? "opened" : f.loc[0] === "note" ? "note" : f.loc[0] === "code" ? "code" : "form";
          if (!got[k]) got[k] = f.msg;
        }
      } else got.form = errorText(er);
      setErrors(got);
      focusFirst(got);
    }
  }

  // ── 값 대조 결과: 관리자가 적은 값과 신청서 글자를 비교한다(띄어쓰기 · 대소문자는 보지 않는다)
  function result(app: string | null | undefined, typed: string, digits?: boolean) {
    if (!typed.trim()) return <span className="mj-st mj-st-off"><Mark k="off" />안 적음</span>;
    const same = digits ? onlyDigits(app ?? "") === onlyDigits(typed) : norm(app ?? "") === norm(typed);
    return same ? <span className="mj-st mj-st-ok"><Mark k="ok" />일치</span> : <span className="mj-st mj-st-bad"><Mark k="bad" />다름</span>;
  }
  const was = (k: string) => (typeof ch[k] === "string" && ch[k] ? <span className={`mj-small ${s.block}`}>바뀜 · 전: {String(ch[k])}</span> : null);
  const wasTrades = Array.isArray(ch.trades) ? <span className={`mj-small ${s.block}`}>바뀜 · 전: {tradesText(ch.trades as string[])}</span> : null;
  const cell = (k: keyof Read, label: string, extra?: { num?: boolean; describedBy?: string }) => (
    <input
      id={k === "opened_on" ? "rd-open" : `rd-${k}`}
      className={`mj-input ${s.cell}${extra?.num ? " mj-num" : ""}`}
      type="text"
      inputMode={extra?.num ? "numeric" : undefined}
      autoComplete="off"
      maxLength={100}
      aria-label={`등록증의 ${label}`}
      aria-invalid={k === "opened_on" && errors.opened ? true : undefined}
      aria-describedby={extra?.describedBy}
      value={read[k]}
      onChange={(e) => { setRead((r) => ({ ...r, [k]: e.target.value })); if (k === "opened_on") clearErr("opened"); }}
    />
  );

  const head = (
    <div className={s.head}>
      <div className={s.headL}>
        <p className="mj-small mj-num">{submitWord} {stamp(v.submitted_at ?? v.created_at)}</p>
        <h2 id="v-t" className="mj-h2" tabIndex={-1}>{name}</h2>
        <p className="mj-small">대표 {v.owner_name ?? "—"} · 공정 {tradesText(v.trades)} · 활동 지역 {v.areas.map((a) => a.label).join(" · ") || "없음"}</p>
      </div>
      <StatusMark status={v.status} />
    </div>
  );

  const compare = decide ? (
    <div className={s.cmp}>
      <h3 className="mj-h3">값 대조</h3>
      <div className="mj-table-box" role="region" tabIndex={0} aria-label="신청서와 등록증 값 대조 표, 옆으로 넘겨 볼 수 있어요">
        <table className="mj-table">
          <caption className="mj-sr">신청서와 사업자등록증 값 대조. 등록증 값은 관리자가 서류를 보고 직접 적어요</caption>
          <thead><tr><th scope="col">항목</th><th scope="col">신청서</th><th scope="col">등록증에서 읽은 값 · 직접 적기</th><th scope="col">결과</th></tr></thead>
          <tbody>
            <tr><th scope="row">상호</th><td>{v.biz_name ?? "—"}{was("biz_name")}</td><td>{cell("biz_name", "상호", { describedBy: "rd-r1" })}</td><td id="rd-r1">{result(v.biz_name, read.biz_name)}</td></tr>
            <tr><th scope="row">대표자</th><td>{v.owner_name ?? "—"}{was("owner_name")}</td><td>{cell("owner_name", "대표자", { describedBy: "rd-r2" })}</td><td id="rd-r2">{result(v.owner_name, read.owner_name)}</td></tr>
            <tr><th scope="row">사업자등록번호</th><td className="mj-num">{bizNoText(v.biz_no)}</td><td>{cell("biz_no", "사업자등록번호", { num: true, describedBy: "rd-r3" })}</td><td id="rd-r3">{result(v.biz_no, read.biz_no, true)}</td></tr>
            <tr>
              <th scope="row">개업일</th><td className="mj-small">신청서에 없어요</td>
              <td>{cell("opened_on", "개업일", { num: true, describedBy: errors.opened ? "rd-open-h rd-open-e" : "rd-open-h" })}<span id="rd-open-h" className={`mj-small ${s.block}`}>적으면 결정과 함께 저장해요 (선택)</span>{errors.opened ? <FieldError id="rd-open-e">{errors.opened}</FieldError> : null}</td>
              <td />
            </tr>
            <tr><th scope="row">업태 · 종목</th><td>공정 {tradesText(v.trades)}{wasTrades}</td><td>{cell("kind", "업태 · 종목")}</td><td><span className="mj-st mj-st-wait"><Mark k="ask" />확인 못 함</span><span className={`mj-small ${s.block}`}>직접 판단해요</span></td></tr>
          </tbody>
        </table>
      </div>
      <p className={`mj-small ${s.legend}`}>결과 표시
        <span className="mj-st mj-st-ok"><Mark k="ok" />일치</span>
        <span className="mj-st mj-st-bad"><Mark k="bad" />다름</span>
        <span className="mj-st mj-st-wait"><Mark k="ask" />확인 못 함</span>
      </p>
    </div>
  ) : (
    <div className={s.cmp}>
      <h3 className="mj-h3">신청 내용</h3>
      <dl className="mj-kv">
        <dt>상호</dt><dd>{v.biz_name ?? "—"}</dd>
        <dt>대표자</dt><dd>{v.owner_name ?? "—"}</dd>
        <dt>사업자등록번호</dt><dd className="mj-num">{bizNoText(v.biz_no)}</dd>
        <dt>개업일</dt><dd className="mj-num">{v.opened_on ? dotDate(v.opened_on) : "적지 않았어요"}</dd>
        <dt>공정</dt><dd>{tradesText(v.trades)}</dd>
      </dl>
    </div>
  );

  const detail = <div className={s.detail}>{head}{viewer}{compare}</div>;

  if (!decide) {
    const last = v.reviews.find((r) => DECIDED.includes(r.action));
    const why = last ? reasonLabel(last.action, last.code) : null;
    return (
      <>
        {detail}
        <section aria-labelledby="d-t" className={s.side}>
          <div className={s.sideHead}><h2 id="d-t" className="mj-h2">결정</h2><p className="mj-small">{name}</p></div>
          {last ? (
            <div className={s.decided}>
              <p className={s.decLine}><StatusMark status={v.status} /> <span className="mj-num">{stamp(last.at)}</span> · {last.by_name ?? "관리자"}</p>
              {why ? <p>사유: {why}</p> : null}
              {last.note ? <figure className={s.say}><figcaption className="mj-small">업체에 보낸 말</figcaption><blockquote>{last.note}</blockquote></figure> : null}
            </div>
          ) : <p className="mj-sub">아직 정하지 않았어요.</p>}
          {v.status === "needs_info" ? <p className="mj-small">업체가 보완해서 다시 보내면 &lsquo;기다림&rsquo;으로 돌아와요.</p> : null}
          {v.status === "rejected" ? <p className="mj-small">업체가 다시 신청하면 &lsquo;기다림&rsquo;으로 돌아와요.</p> : null}
          <Log v={v} name={name} />
        </section>
      </>
    );
  }

  const whyNow = reasonLabel(decision, code);
  return (
    <>
      {detail}
      <form id="dec" noValidate aria-labelledby="d-t" className={s.side} onSubmit={onSubmit}>
        <div className={s.sideHead}><h2 id="d-t" className="mj-h2">판단</h2><p className="mj-small">{name}</p></div>

        <fieldset className="mj-fieldset">
          <legend className="mj-label">확인한 것 (승인하려면 셋 다)</legend>
          <div className={s.cks}>
            <label className={s.ck}><input type="checkbox" checked={checks.name} onChange={(e) => setCheck("name", e.target.checked)} />상호가 등록증과 같아요</label>
            <label className={s.ck}><input type="checkbox" checked={checks.owner} onChange={(e) => setCheck("owner", e.target.checked)} />대표자가 등록증과 같아요</label>
            <label className={s.ck}><input type="checkbox" checked={checks.biz} onChange={(e) => setCheck("biz", e.target.checked)} /><span>업종이 인테리어 공사와 맞아요{read.kind.trim() ? <span className="mj-small">등록증 종목: {read.kind.trim()}</span> : null}</span></label>
          </div>
        </fieldset>

        <fieldset className="mj-fieldset" aria-describedby={errors.decision ? "dc-e" : undefined}>
          <legend className="mj-label">결정 (필수)</legend>
          <div className={s.cks}>
            <label className={s.ck}>
              <input id={allChecked ? "dc-first" : "dc-ap"} type="radio" name="decision" value="approve" checked={decision === "approve"} disabled={!allChecked} aria-describedby="dc-ap-h" onChange={() => pick("approve")} />
              <span><span className={s.b}>승인</span><span id="dc-ap-h" className="mj-small">{allChecked ? "업체 기능을 바로 열어요" : "확인 3개를 모두 체크해야 고를 수 있어요"}</span></span>
            </label>
            <label className={s.ck}>
              <input id={allChecked ? "dc-ni" : "dc-first"} type="radio" name="decision" value="needs_info" checked={decision === "needs_info"} onChange={() => pick("needs_info")} />
              <span><span className={s.b}>보완 요청</span><span className="mj-small">서류를 다시 받아요</span></span>
            </label>
            <label className={s.ck}>
              <input type="radio" name="decision" value="reject" checked={decision === "reject"} onChange={() => pick("reject")} />
              <span><span className={s.b}>거절</span><span className="mj-small">이번 신청을 받지 않아요</span></span>
            </label>
          </div>
          {errors.decision ? <FieldError id="dc-e">{errors.decision}</FieldError> : null}
        </fieldset>

        <div className="mj-field">
          <label htmlFor="rs-t" className="mj-label">사유{reasons.length ? " (필수)" : ""}</label>
          <select id="rs-t" className="mj-select" disabled={!reasons.length} value={code} aria-invalid={errors.code ? true : undefined} aria-describedby={[decision === "needs_info" ? "rs-t-h" : "", errors.code ? "rs-t-e" : ""].filter(Boolean).join(" ") || undefined} onChange={(e) => { setCode(e.target.value); clearErr("code"); clearErr("note"); }}>
            {reasons.length ? reasons.map((r) => <option key={r.key} value={r.key}>{r.label}</option>) : <option value="">{decision === "approve" ? "승인일 때는 안 써요" : "결정을 고르면 골라요"}</option>}
          </select>
          {decision === "needs_info" ? (
            <p id="rs-t-h" className="mj-hint" role="status"><b className={s.ink}>업체에게 열릴 칸: {needsInfoOpenText(code)}</b></p>
          ) : null}
          {errors.code ? <FieldError id="rs-t-e">{errors.code}</FieldError> : null}
        </div>

        <div className="mj-field">
          <label htmlFor="rs" className="mj-label">업체에 보낼 말{noteNeed ? " (필수)" : noteOn ? " (선택)" : ""}</label>
          <textarea id="rs" className="mj-textarea" maxLength={NOTE_MAX} rows={3} disabled={!noteOn} value={noteOn ? note : ""} aria-invalid={errors.note ? true : undefined} aria-describedby={errors.note ? "rs-c rs-e" : "rs-c"} onChange={(e) => { setNote(e.target.value); clearErr("note"); }} />
          <p id="rs-c" className="mj-hint mj-num">{NOTE_MAX - (noteOn ? note.length : 0)}자 남았어요</p>
          {errors.note ? <FieldError id="rs-e">{errors.note}</FieldError> : null}
        </div>

        <div role="group" aria-labelledby="pv-t" className={s.preview}>
          <p id="pv-t" className="mj-label">업체 홈에 이렇게 보여요</p>
          {decision === "approve" ? (
            <>
              <p>가입 심사가 끝났어요. 이제 고객 요청을 받을 수 있어요.</p>
              <p className={`mj-small ${s.ink}`}>가견적에 쓸 견적서 · 실측 방식 · 활동 지역을 먼저 확인해 주세요.</p>
            </>
          ) : noteOn ? (
            <>
              <p className={s.b}>{decision === "reject" ? "이번 신청은 받지 않았어요" : needsInfoTitle(code)}</p>
              {whyNow || note.trim() ? (
                <p className={`mj-small ${s.ink}`}>
                  {whyNow ? <>사유: {whyNow}</> : null}
                  {whyNow && note.trim() ? <br /> : null}
                  {note.trim() ? <>관리자가 남긴 말: {note.trim()}</> : null}
                </p>
              ) : null}
            </>
          ) : <p className="mj-small">결정을 고르면 업체 홈에 보일 모습이 나와요.</p>}
        </div>

        {taken ? (
          <div className={`mj-notice mj-notice-bad ${s.taken}`}>
            <p id="dc-taken" tabIndex={-1} role="alert" className={s.takenMsg}><Mark k="bad" />{taken}</p>
            <button type="button" className="mj-btn mj-btn-sec" onClick={() => { setTaken(""); router.refresh(); }}>새로 열기</button>
          </div>
        ) : null}

        <div className={s.save}>
          <button ref={saveBtn} type="submit" className="mj-btn mj-btn-pri" disabled={busy} aria-describedby="sv-h">{busy ? "저장하는 중이에요" : "결정 저장하기"}</button>
          <p id="sv-h" className="mj-small">저장하면 바로 업체 홈과 알림에 보여요.</p>
          {errors.form ? <div id="sv-e" tabIndex={-1}><FieldError id="sv-e-t" alert>{errors.form}</FieldError></div> : null}
        </div>

        <Log v={v} name={name} />
      </form>

      <dialog ref={dlg} className={s.dlg} aria-labelledby="rj-t" onClose={() => saveBtn.current?.focus()}>
        <button type="button" className={s.x} aria-label="닫기" onClick={() => dlg.current?.close()}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
        </button>
        <h3 id="rj-t" className="mj-h3">{name} 가입을 거절할까요?</h3>
        <p>사유가 업체에 보여요. 업체는 같은 번호로 다시 신청할 수 있어요.</p>
        <p className={`mj-small ${s.ink}`}>{whyNow ? `사유: ${whyNow}` : `업체에 보낼 말: ${note.trim()}`}</p>
        <div className={s.dlgBtns}>
          <button type="button" className="mj-btn mj-btn-danger" onClick={() => { dlg.current?.close(); void save(); }}>거절하기</button>
          <button type="button" className="mj-btn mj-btn-sec" autoFocus onClick={() => dlg.current?.close()}>돌아가기</button>
        </div>
      </dialog>
    </>
  );
}
