"use client";
// 공사 중 추가 금액 알리기 (시안 WVCalendar '추가 금액 알리기'). 공사 날짜를 수락한 뒤 · 남은 일을 하는 동안(scheduled · fixing)만 알린다.
// 한 일 · 이유 · 금액 · 부가세 방식 · 사진(선택, 먼저 POST /files kind=work_photo) → 확인 창 → POST /vendor/jobs/{id}/extras.
// 고객에게 보이는 금액 · 공급가 · 부가세 · 합계는 응답(계산 엔진) 값만 보인다. 고치기 · 지우기는 없어서 잘못 올렸으면 새로 올린다.
// 그 밖의 상태에서 올리면 409(서버 문장)를 보이고 다시 읽는다.
import { useRef, useState } from "react";
import { FieldError } from "@/components/auth/parts";
import { Dash } from "@/components/pro/inbox/Cells";
import { DoneNote } from "@/components/pro/inbox/DoneNote";
import { digitsText, fileProblem } from "@/components/pro/profile/text";
import { AMOUNT_MAX, VAT_LABEL, amountDigits } from "@/components/pro/quote/text";
import { ApiError, call, errorText, type Schemas } from "@/lib/backend/client";
import { euro, won } from "@/lib/format";
import {
  EXTRA_PHOTO, EXTRA_PHOTOS_MAX, EXTRA_TITLE_MAX, EXTRA_VAT_HINT, REASON_MAX, VENDOR_ACK, canAddExtra, extraTail, stamp,
  type Extra, type ExtraVat, type Extras, type Job,
} from "./text";
import s from "./jobs.module.css";

type Photo = { id: string; filename: string };
type Fields = { title: string; reason: string; amount: string; vat: ExtraVat; photos: Photo[] };
type Key = "title" | "reason" | "photos" | "amount" | "vat";
type Errs = Partial<Record<Key, string>>;
type Bad = { name: string; msg: string };

const ORDER: Key[] = ["title", "reason", "photos", "amount", "vat"];
const FOCUS: Record<Key, string> = { title: "x-title", reason: "x-why", photos: "x-up", amount: "x-amt", vat: "x-vat-0" };
const LOC: Record<string, Key> = { title: "title", reason: "reason", entered_amount: "amount", vat_mode: "vat", file_ids: "photos" };
const TEXT: Record<Key, string> = {
  title: `한 일을 ${EXTRA_TITLE_MAX}자까지 적어 주세요.`,
  reason: `이유를 ${REASON_MAX}자까지 적어 주세요. 고객에게 보여요.`,
  photos: "올린 공사 사진을 다시 확인해 주세요.",
  amount: "금액은 10억 원까지 넣어 주세요.",
  vat: "부가세 방식을 다시 골라 주세요.",
};

const empty = (modes: ExtraVat[]): Fields => ({ title: "", reason: "", amount: "", vat: modes.includes("excluded") ? "excluded" : modes[0], photos: [] });

/** API 오류 → 칸별 문장. 입력 검사(fields)는 칸 이름으로, 서버 문장(code = vat_mode · file · file_used)은 그대로 */
function errsOf(e: ApiError): Errs | null {
  const out: Errs = {};
  if (e.fields?.length) {
    for (const x of e.fields) {
      const k = x.loc.map((p) => LOC[p]).find(Boolean);
      if (k) out[k] = k === "photos" ? x.msg || TEXT.photos : TEXT[k];
      else if (!x.loc.length && x.msg) out.photos = x.msg; // 같은 사진을 두 번 붙였어요
    }
  } else if (e.code === "vat_mode") out.vat = e.message;
  else if (e.code === "file" || e.code === "file_used") out.photos = e.message;
  return Object.keys(out).length ? out : null;
}

function focusFirst(e: Errs) {
  const k = ORDER.find((x) => e[x]);
  if (k) setTimeout(() => document.getElementById(FOCUS[k])?.focus(), 0);
}

const Check = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M2.5 7.5l3 3 6-7" /></svg>;
const Up = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M8 11V2.5M4.5 6L8 2.5 11.5 6" /><path d="M2.5 11v2.5h11V11" /></svg>;

/** 고객 답 상태 칩 (확인 기다림 · 확인함 · 이야기하고 싶어 함) */
function AckChip({ x }: { x: Extra }) {
  const when = x.acked_at ? <span className="mj-num"> · {stamp(x.acked_at)}</span> : null;
  if (x.ack === "ok") return <p className="mj-st mj-st-ok"><Check />{VENDOR_ACK.ok}{when}</p>;
  if (x.ack === "talk") return <p className="mj-st mj-st-now">{VENDOR_ACK.talk}{when}</p>;
  return <p className="mj-st mj-st-wait"><Dash />{VENDOR_ACK.pending}</p>;
}

/** 합계: 확인함 · 기다림 · 이야기 중 (계산 엔진 값, 공급가 · 부가세를 나눠 보인다) */
function Totals({ x }: { x: Extras }) {
  const rows: [string, Schemas["MoneyOut"]][] = [["확인함", x.ok], ["기다림", x.pending], ["이야기 중", x.talk]];
  return (
    <>
      <dl className={`mj-num ${s.exSum}`} aria-label="추가 금액 합계">
        {rows.map(([t, m]) => (
          <div key={t}>
            <dt>{t}</dt>
            <dd><b className={s.big}>{won(m.total)}</b><span className="mj-small">공급가 {won(m.supply)} · 부가세 {won(m.vat)}</span></dd>
          </div>
        ))}
      </dl>
      <p className="mj-small">금액은 고객과 직접 정해요.</p>
    </>
  );
}

type Props = {
  dealId: string;
  initial: Pick<Job, "extras" | "status">;
  /** 고를 수 있는 부가세 방식 (면세 업체는 면세만) */
  modes: ExtraVat[];
  /** 머리 줄: "김하늘 · 상계동 도배 · 확정 금액 338만 8,000원" */
  head: string;
  /** "김하늘 님" · "고객" */
  who: string;
};

export function JobExtras({ dealId, initial, modes, head, who }: Props) {
  const [seen, setSeen] = useState(initial);
  const [extras, setExtras] = useState(initial.extras);
  const [status, setStatus] = useState(initial.status);
  const [f, setF] = useState<Fields>(() => empty(modes));
  const [errs, setErrs] = useState<Errs>({});
  const [busy, setBusy] = useState<"" | "upload" | "send">("");
  const [bad, setBad] = useState<Bad[]>([]);
  const [upMsg, setUpMsg] = useState("");
  const [sendErr, setSendErr] = useState("");
  const [lock, setLock] = useState<string | null>(null); // 409 invalid_state → 서버 문장
  const [note, setNote] = useState<string | null>(null);
  const fileIn = useRef<HTMLInputElement>(null);
  const upBtn = useRef<HTMLButtonElement>(null);
  const dlg = useRef<HTMLDialogElement>(null);
  const sent = useRef(false);

  // 화면을 새로 그리면(router.refresh) 새 값으로 바꾼다
  if (seen !== initial) {
    setSeen(initial);
    setExtras(initial.extras);
    setStatus(initial.status);
  }

  const open = canAddExtra(status) && !lock;
  const items = extras.items;
  const err = (k: Key, hint?: string) => [hint, errs[k] ? `${FOCUS[k]}-e` : ""].filter(Boolean).join(" ") || undefined;

  function change(x: Partial<Fields>) {
    setF((old) => ({ ...old, ...x }));
    setErrs((m) => { const n = { ...m }; for (const k of Object.keys(x)) delete n[k as Key]; return n; });
    setNote(null);
  }

  async function upload(list: FileList | null) {
    const picked = Array.from(list ?? []);
    if (fileIn.current) fileIn.current.value = "";
    if (!picked.length || busy) return;
    const fails: Bad[] = [];
    const added: Photo[] = [];
    setBusy("upload"); setBad([]); setNote(null);
    for (const [i, file] of picked.entries()) {
      if (f.photos.length + added.length >= EXTRA_PHOTOS_MAX) { fails.push({ name: file.name, msg: `사진은 ${EXTRA_PHOTOS_MAX}장까지 붙일 수 있어요.` }); continue; }
      const p = fileProblem(file, EXTRA_PHOTO, "JPG · PNG · WebP · HEIC 사진만 올릴 수 있어요.");
      if (p) { fails.push({ name: file.name, msg: p }); continue; }
      setUpMsg(`사진을 올리고 있어요 (${i + 1}/${picked.length})`);
      try {
        const fd = new FormData();
        fd.append("kind", "work_photo");
        fd.append("file", file, file.name);
        const up = await call<Schemas["FileOut"]>("POST", "/files", fd);
        added.push({ id: up.id, filename: up.filename });
      } catch (e) {
        fails.push({ name: file.name, msg: errorText(e) });
      }
    }
    setBusy("");
    setBad(fails);
    if (added.length) {
      setF((old) => ({ ...old, photos: [...old.photos, ...added] }));
      setErrs((m) => { const n = { ...m }; delete n.photos; return n; });
      setUpMsg(`사진 ${added.length}장을 올렸어요.`);
    } else setUpMsg("");
  }

  function removePhoto(p: Photo) {
    change({ photos: f.photos.filter((x) => x.id !== p.id) });
    setBad([]);
    setUpMsg(`‘${p.filename}’를 뺐어요.`);
    setTimeout(() => upBtn.current?.focus(), 0);
  }

  /** '추가 금액 알리기': 빠진 칸이 있으면 그 칸으로, 없으면 확인 창 */
  function ask() {
    if (busy || !open) return;
    const miss: Errs = {};
    if (!f.title.trim()) miss.title = "한 일을 적어 주세요.";
    if (!f.reason.trim()) miss.reason = "이유를 적어 주세요. 고객에게 보여요.";
    if (!f.amount) miss.amount = "금액을 넣어 주세요.";
    else if (Number(f.amount) > AMOUNT_MAX) miss.amount = TEXT.amount;
    const all = { ...errs, ...miss };
    if (Object.keys(all).length) { setErrs(all); focusFirst(all); return; }
    setSendErr("");
    dlg.current?.showModal();
  }

  async function reload() {
    try {
      const out = await call<Job>("GET", `/vendor/jobs/${dealId}`);
      setExtras(out.extras);
      setStatus(out.status);
    } catch {
      // 다시 읽지 못하면 지금 목록을 둔다
    }
  }

  async function send() {
    if (busy) return;
    setBusy("send"); setSendErr("");
    try {
      const out = await call<Job>("POST", `/vendor/jobs/${dealId}/extras`, {
        title: f.title.trim(), reason: f.reason.trim(), entered_amount: Number(f.amount), vat_mode: f.vat, file_ids: f.photos.map((p) => p.id),
      });
      sent.current = true;
      dlg.current?.close();
      setExtras(out.extras);
      setStatus(out.status);
      const last = out.extras.items.at(-1);
      setF(empty(modes));
      setErrs({}); setBad([]); setUpMsg("");
      setNote(`추가 금액을 알렸어요.${last ? ` 고객에게 ${won(last.total)} · ${euro(extraTail(last.vat_mode))} 보여요.` : ""} 고객이 답하면 알림으로 알려 드려요.`);
    } catch (e) {
      if (!(e instanceof ApiError)) { setSendErr(errorText(e)); return; }
      const fe = e.status === 422 || e.code === "file_used" ? errsOf(e) : null;
      if (fe) { dlg.current?.close(); setErrs((m) => ({ ...m, ...fe })); focusFirst(fe); return; }
      // 공사를 끝냈다고 올림 · 다시 고름: 서버 문장을 보이고 새로 읽는다
      if (e.status === 409 && e.code === "invalid_state") { dlg.current?.close(); setLock(e.message); await reload(); return; }
      setSendErr(e.message);
    } finally {
      setBusy("");
    }
  }

  const shut = lock ?? (status === "checking" ? "공사를 끝냈다고 올린 뒤에는 추가 금액을 알릴 수 없어요." : status === "done" ? "공사가 끝나 추가 금액을 알릴 수 없어요." : null);
  const photoSrc = (x: Extra, fileId: string) => `/api/vendor/jobs/${dealId}/extras/${x.id}/files/${fileId}`;

  return (
    <section aria-labelledby="x-t" className={s.formSec}>
      <div className={s.exHead}>
        <h2 id="x-t" className="mj-h2">추가 금액 알리기</h2>
        <p className="mj-sub mj-num">{head}</p>
      </div>

      {note ? <DoneNote text={note} /> : null}
      {shut ? <p role={lock ? "alert" : undefined} className="mj-notice mj-notice-warn"><span><b>{shut}</b></span></p> : null}

      {open ? (
        <form aria-labelledby="x-t" noValidate onSubmit={(e) => { e.preventDefault(); ask(); }}>
          <div className={s.exCols}>
            <div className={s.exCol}>
              <div className="mj-field">
                <label htmlFor="x-title" className="mj-label">한 일 <span className="mj-opt">(필수)</span></label>
                <input id="x-title" className="mj-input" autoComplete="off" maxLength={EXTRA_TITLE_MAX} value={f.title}
                  aria-required="true" aria-invalid={errs.title ? true : undefined} aria-describedby={err("title", "x-title-h")}
                  onChange={(e) => change({ title: e.target.value })} />
                <p id="x-title-h" className="mj-hint">예: 곰팡이 방지 처리. {EXTRA_TITLE_MAX}자까지 적어요.</p>
                {errs.title ? <FieldError id="x-title-e">{errs.title}</FieldError> : null}
              </div>

              <div className="mj-field">
                <label htmlFor="x-why" className="mj-label">이유 <span className="mj-opt">(필수 · 고객에게 보여요)</span></label>
                <textarea id="x-why" className="mj-textarea" rows={3} maxLength={REASON_MAX} value={f.reason}
                  aria-required="true" aria-invalid={errs.reason ? true : undefined} aria-describedby={err("reason", "x-why-h")}
                  onChange={(e) => change({ reason: e.target.value })} />
                <p id="x-why-h" className="mj-hint">예: 안방 창가 벽에 곰팡이가 있어 방지 처리를 했어요. {REASON_MAX}자까지 적어요.</p>
                {errs.reason ? <FieldError id="x-why-e">{errs.reason}</FieldError> : null}
              </div>

              <div className="mj-field">
                <p id="x-ph-l" className="mj-label">사진 <span className="mj-opt">(선택)</span></p>
                {f.photos.length ? (
                  <ul className={s.exPhotos} aria-labelledby="x-ph-l">
                    {f.photos.map((p, i) => (
                      <li key={p.id}>
                        <img className={s.pic} src={`/api/files/${p.id}`} alt={`올린 사진 ${i + 1}: ${p.filename}`} width={88} height={88} />
                        <button type="button" className="mj-btn mj-btn-sec mj-btn-sm" aria-label={`${p.filename} 빼기`} onClick={() => removePhoto(p)}>빼기</button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className={s.btns}>
                  <button ref={upBtn} id="x-up" type="button" className="mj-btn mj-btn-sec" aria-describedby={err("photos", "x-ph-h")}
                    disabled={busy === "upload" || f.photos.length >= EXTRA_PHOTOS_MAX} onClick={() => fileIn.current?.click()}>
                    <Up />{busy === "upload" ? "올리는 중이에요" : "사진 올리기"}
                  </button>
                  <input ref={fileIn} type="file" multiple hidden accept={EXTRA_PHOTO.accept} onChange={(e) => void upload(e.target.files)} />
                </div>
                <p id="x-ph-h" className="mj-hint">
                  {f.photos.length >= EXTRA_PHOTOS_MAX ? `${EXTRA_PHOTOS_MAX}장을 모두 붙였어요. 더 붙이려면 하나를 빼 주세요.` : `JPG · PNG · WebP · HEIC · 한 장 ${EXTRA_PHOTO.mb}MB · ${EXTRA_PHOTOS_MAX}장까지. 고객에게 보여요.`}
                </p>
                {errs.photos ? <FieldError id="x-up-e">{errs.photos}</FieldError> : null}
                {bad.length ? (
                  <ul className={s.upBad} aria-label="올리지 못한 사진">
                    {bad.map((b, i) => <li key={i}><b>{b.name}</b> <span className="mj-error">{b.msg}</span></li>)}
                  </ul>
                ) : null}
                <p className="mj-small" role="status">{upMsg}</p>
              </div>
            </div>

            <div className={s.exCol}>
              <div className="mj-field">
                <label htmlFor="x-amt" className="mj-label">금액(원) <span className="mj-opt">(필수)</span></label>
                <div className={s.exUnit}>
                  <input id="x-amt" className="mj-input mj-num" inputMode="numeric" autoComplete="off" value={digitsText(f.amount)}
                    aria-required="true" aria-invalid={errs.amount ? true : undefined} aria-describedby={err("amount", "x-amt-h")}
                    onChange={(e) => change({ amount: amountDigits(e.target.value) })} />
                  <span aria-hidden="true">원</span>
                </div>
                <p id="x-amt-h" className="mj-hint">{EXTRA_VAT_HINT[f.vat]}</p>
                {errs.amount ? <FieldError id="x-amt-e">{errs.amount}</FieldError> : null}
              </div>

              {modes.length > 1 ? (
                <fieldset className="mj-fieldset" aria-describedby={err("vat")}>
                  <legend className="mj-label">적은 금액은 <span className="mj-opt">(필수)</span></legend>
                  <div className={s.rads}>
                    {modes.map((m, i) => (
                      <label key={m} className={s.rad}>
                        <input id={`x-vat-${i}`} type="radio" name="x-vat" value={m} checked={f.vat === m} aria-invalid={errs.vat ? true : undefined}
                          onChange={() => change({ vat: m })} />{VAT_LABEL[m]}
                      </label>
                    ))}
                  </div>
                  {errs.vat ? <FieldError id="x-vat-0-e">{errs.vat}</FieldError> : null}
                </fieldset>
              ) : (
                <div className="mj-field">
                  <p className="mj-label">적은 금액은</p>
                  <p id="x-vat-0" tabIndex={-1}>{VAT_LABEL[modes[0] ?? "exempt"]}</p>
                  <p className="mj-hint">면세 업체라 면세로만 적어요.</p>
                  {errs.vat ? <FieldError id="x-vat-0-e">{errs.vat}</FieldError> : null}
                </div>
              )}

              <p className={s.cust}>
                <span className="mj-sub">고객에게 보이는 금액</span>
                <span>올리면 믿집이 계산해 보여 줘요</span>
              </p>

              <div><button id="x-send" type="submit" className="mj-btn mj-btn-sec" disabled={!!busy}>추가 금액 알리기</button></div>
              <p className="mj-small">확정 금액은 그대로고, 고객 화면에 따로 한 줄로 남아요. 고객은 ‘확인했어요’ 또는 ‘이야기하고 싶어요’를 눌러요. 올린 뒤에는 고칠 수 없어서, 잘못 올렸으면 새로 올려요.</p>
            </div>
          </div>
        </form>
      ) : null}

      {items.length ? (
        <div className={s.exList}>
          <h3 className="mj-h3">올린 추가 금액 <span className="mj-num">{items.length}</span>건</h3>
          <ol className={s.exItems}>
            {items.map((x) => (
              <li key={x.id}>
                <div className={s.exTop}>
                  <p className={s.exTitle}><b>{x.title}</b></p>
                  <AckChip x={x} />
                </div>
                <p className="mj-num"><b className={s.big}>{won(x.total)}</b> <span className="mj-small">{extraTail(x.vat_mode)} · 고객에게 보이는 금액</span></p>
                <p className="mj-small mj-num">적은 금액 {won(x.entered_amount)} · {VAT_LABEL[x.vat_mode as ExtraVat] ?? ""} · {stamp(x.created_at)}에 알렸어요</p>
                <p className={s.exText}>{x.reason}</p>
                {x.photos.length ? (
                  <ul className={s.exPhotos} aria-label={`${x.title} 사진 ${x.photos.length}장`}>
                    {x.photos.map((p, i) => (
                      <li key={p.file_id}>
                        <a href={photoSrc(x, p.file_id)} target="_blank" rel="noopener">
                          <img className={s.pic} src={photoSrc(x, p.file_id)} alt={`${x.title} 사진 ${i + 1}`} loading="lazy" width={88} height={88} />
                          <span className="mj-sr">, 새 창</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {x.ack === "talk" ? <p className="mj-small">{who}에게 전화해 금액을 이야기해요.</p> : null}
              </li>
            ))}
          </ol>
          <Totals x={extras} />
        </div>
      ) : null}

      <dialog ref={dlg} className={s.dlg} aria-labelledby="xd-t" onClose={() => { if (sent.current) { sent.current = false; return; } document.getElementById("x-send")?.focus(); }}>
        <button type="button" className={s.x} aria-label="닫기" onClick={() => dlg.current?.close()}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
        </button>
        <h2 id="xd-t" className="mj-h3">추가 금액을 알릴까요?</h2>
        <dl className={`mj-num ${s.sum}`}>
          <div><dt>한 일</dt><dd className={s.sumText}>{f.title.trim()}</dd></div>
          <div><dt>이유</dt><dd className={s.sumText}>{f.reason.trim()}</dd></div>
          <div><dt>적은 금액</dt><dd><b>{f.amount ? won(Number(f.amount)) : "—"}</b> · {VAT_LABEL[f.vat]}</dd></div>
          <div><dt>사진</dt><dd>{f.photos.length ? `${f.photos.length}장` : "없음"}</dd></div>
        </dl>
        <p>{who}에게 알림이 가요. 고객에게 보이는 금액은 믿집이 계산해요. 올린 뒤에는 고치거나 지울 수 없어요.</p>
        {sendErr ? <FieldError id="xd-e" alert>{sendErr}</FieldError> : null}
        <div className={s.dlgBtns}>
          <button type="button" className="mj-btn mj-btn-sec" onClick={() => dlg.current?.close()}>돌아가기</button>
          <button type="button" className="mj-btn mj-btn-pri" onClick={() => void send()} disabled={!!busy}>{busy === "send" ? "알리는 중이에요" : "추가 금액 알리기"}</button>
        </div>
      </dialog>
    </section>
  );
}
