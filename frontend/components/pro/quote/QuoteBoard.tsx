"use client";
// 실측 견적서 올리기 (시안 WVQuote). 견적서 파일(필수 · 여러 개 · 순서) + 요약 칸 → 임시 저장(PUT, 통째) → 보내기(POST .../send).
// 칸을 고치면 잠깐 쉬었다가(600ms) 임시 저장하고, '고객에게는 ○○원으로 보여요'는 저장 응답의 total(계산 엔진)만 보인다.
// 보낸 뒤에는 보낸 버전을 읽기로 보이고, 견적서 옴이면 '고쳐서 다시 올리기'로 다음 버전 임시 저장본(PUT, 보낸 칸 그대로 · 파일은 새로)을
// 만들어 같은 쓰기 화면을 연다 → 다시 올리기(POST .../send). 확정 · 닫힘 뒤에는 다시 올리기를 막고 서버 문장을 보인다.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FieldError } from "@/components/auth/parts";
import { DoneNote } from "@/components/pro/inbox/DoneNote";
import { PRICE_DOC, digitsText, fileKind, fileProblem } from "@/components/pro/profile/text";
import { ApiError, call, errorText, type Schemas } from "@/lib/backend/client";
import { fileSize, stampSeoul, won } from "@/lib/format";
import { DateField } from "./DateField";
import { DocIcon, SentQuote, Versions } from "./SentQuote";
import {
  AMOUNT_MAX, CHOSEN_TEXT, CLOSED, MISSING, ORDER, VAT_LABEL, amountDigits, dayDigits, resendBody, totalTail,
  type Board, type Body, type Errs, type Key, type QFile, type VatMode,
} from "./text";
import s from "./quote.module.css";

// 실측 견적서 파일은 가견적 근거 파일과 서버 규칙이 같다 (files.service RULES: quote_doc · price_doc = DOCS, 20MB)
const QUOTE_DOC = PRICE_DOC;

type Fields = { files: QFile[]; measured_on: string; entered_amount: string; vat_mode: VatMode | ""; days: string; valid_until: string };
type Bad = { name: string; msg: string };
type Busy = "" | "upload" | "check" | "send";

function fieldsOf(b: Board): Fields {
  const d = b.draft;
  const modes = b.vat_modes as VatMode[];
  const saved = d?.vat_mode as VatMode | null | undefined;
  return {
    files: [...(d?.files ?? [])].sort((x, y) => x.sort - y.sort),
    measured_on: d?.measured_on ?? "",
    entered_amount: d?.entered_amount != null ? String(d.entered_amount) : "",
    vat_mode: saved && modes.includes(saved) ? saved : modes.length === 1 ? modes[0] : "",
    days: d?.days != null ? String(d.days) : "",
    valid_until: d?.valid_until ?? "",
  };
}

function bodyOf(f: Fields): Body {
  return {
    file_ids: f.files.map((x) => x.file_id),
    measured_on: f.measured_on || null,
    entered_amount: f.entered_amount ? Number(f.entered_amount) : null,
    vat_mode: f.vat_mode || null,
    days: f.days ? Number(f.days) : null,
    valid_until: f.valid_until || null,
  };
}

/** 서버가 받지 않는 값은 저장하기 전에 거른다 */
function localErrs(f: Fields, daysMax: number): Errs {
  const e: Errs = {};
  if (f.entered_amount && Number(f.entered_amount) > AMOUNT_MAX) e.entered_amount = "낼 금액은 10억 원까지 넣을 수 있어요.";
  if (f.days && (Number(f.days) < 1 || Number(f.days) > daysMax)) e.days = `공사 기간은 1일부터 ${daysMax}일까지 넣어 주세요.`;
  return e;
}

/** API 오류 → 칸별 문장 (빠진 칸 422 fields, 칸 이름 code, 입력 검사 loc) */
function errsOf(e: ApiError): Errs | null {
  const out: Errs = {};
  const add = (k: string, msg: string) => {
    const key = k === "file" || k === "file_ids" ? "files" : k;
    if ((ORDER as string[]).includes(key)) out[key as Key] = msg;
  };
  if (e.fields?.length) for (const x of e.fields) add(String(x.loc[0] ?? ""), x.msg);
  else add(e.code, e.message);
  return Object.keys(out).length ? out : null;
}

/** 칸 → 초점을 옮길 요소 */
const FOCUS: Record<Key, string> = {
  files: "qf-up", measured_on: "q-measured", entered_amount: "q-amount", vat_mode: "q-vat-0", days: "q-days", valid_until: "q-valid",
};
function focusFirst(e: Errs) {
  const k = ORDER.find((x) => e[x]);
  if (k) setTimeout(() => document.getElementById(FOCUS[k])?.focus(), 0);
}

const Check = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M2.5 7.5l3 3 6-7" /></svg>;
const Up = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M8 11V2.5M4.5 6L8 2.5 11.5 6" /><path d="M2.5 11v2.5h11V11" /></svg>;

type Props = {
  visitId: string;
  initial: Board;
  /** 오늘 서울 날짜 (달력에서 고를 수 있는 날) */
  today: string;
  /** 고객 이름 (연락처를 보냈을 때). 확인 창 문장에 쓴다 */
  who: string | null;
  /** 이미 닫힌 요청이면 어떻게 끝났나 (서버 화면이 만든 문장) */
  closedText: string | null;
  /** 요청 요약 (서버 화면이 그린 조각) */
  brief: React.ReactNode;
};

export function QuoteBoard({ visitId, initial, today, who, closedText, brief }: Props) {
  const router = useRouter();
  const path = `/vendor/visits/${visitId}/quote`;
  const [board, setBoard] = useState(initial);
  const [f, setF] = useState<Fields>(() => fieldsOf(initial));
  const [errs, setErrs] = useState<Errs>({});
  const [busy, setBusy] = useState<Busy>("");
  const [saving, setSaving] = useState(false);
  const [stale, setStale] = useState(false); // 고친 값이 아직 저장 응답에 반영되지 않음
  const [saveErr, setSaveErr] = useState("");
  const [sendErr, setSendErr] = useState("");
  const [msg, setMsg] = useState(""); // 파일 칸 안내 (올림 · 뺌 · 옮김)
  const [actMsg, setActMsg] = useState(""); // 버튼 줄 안내 (임시 저장)
  const [bad, setBad] = useState<Bad[]>([]);
  const [lock, setLock] = useState<string | null>(null); // 쓰는 중에 요청이 닫힘(409) → 서버 문장
  const [note, setNote] = useState<string | null>(null); // 보낸 뒤 맨 위 한 줄
  const [editing, setEditing] = useState(false); // 보낸 뒤 다음 버전을 고치는 중
  const [reBusy, setReBusy] = useState(false);
  const [reErr, setReErr] = useState("");

  const cur = useRef(f); // 저장할 때 읽는 최신 칸 값
  const edits = useRef(0); // 칸을 고친 횟수
  const done = useRef(0); // 마지막으로 저장한 때의 edits
  const chain = useRef<Promise<boolean>>(Promise.resolve(true)); // 저장은 한 번에 하나씩, 차례대로
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fileIn = useRef<HTMLInputElement>(null);
  const upBtn = useRef<HTMLButtonElement>(null);
  const dlg = useRef<HTMLDialogElement>(null);
  const max = initial.files_max;
  const modes = initial.vat_modes as VatMode[];

  function onError(e: unknown, focus: boolean) {
    if (e instanceof ApiError) {
      if (e.status === 409 && e.code === "invalid_state") { stopTimer(); setLock(e.message); return; }
      const fe = e.status === 422 ? errsOf(e) : null;
      if (fe) { setErrs((m) => ({ ...m, ...fe })); if (focus) focusFirst(fe); return; }
    }
    setSaveErr(errorText(e));
  }

  function stopTimer() {
    clearTimeout(timer.current);
    timer.current = undefined;
  }

  /** 임시 저장. 고친 게 없으면 건너뛴다(force면 그래도 저장). 앞 저장이 끝난 뒤에 최신 값으로 보낸다. */
  function save(opt: { force?: boolean; focus?: boolean } = {}): Promise<boolean> {
    stopTimer();
    const run = chain.current.then(async () => {
      const ver = edits.current;
      if (!opt.force && ver === done.current) return true;
      const fl = cur.current;
      const le = localErrs(fl, initial.days_max);
      if (Object.keys(le).length) {
        setErrs((m) => ({ ...m, ...le }));
        if (opt.focus) focusFirst(le);
        return false;
      }
      setSaving(true);
      try {
        const out = await call<Board>("PUT", path, bodyOf(fl));
        done.current = ver;
        setBoard(out);
        if (edits.current === ver) setStale(false);
        setSaveErr("");
        return true;
      } catch (e) {
        onError(e, !!opt.focus);
        return false;
      } finally {
        setSaving(false);
      }
    });
    chain.current = run;
    return run;
  }

  // 쉬는 사이에 화면을 떠나면 남은 저장을 보낸다
  useEffect(() => () => { if (timer.current) void save(); }, []); // save는 ref만 읽어서 처음 값으로 충분하다

  function change(p: Partial<Fields>, later = false) {
    if (lock) return;
    const next = { ...cur.current, ...p };
    cur.current = next;
    setF(next);
    edits.current += 1;
    setStale(true);
    setErrs((m) => { const n = { ...m }; for (const k of Object.keys(p)) delete n[k as Key]; return n; });
    setSaveErr("");
    setActMsg("");
    stopTimer();
    if (later) timer.current = setTimeout(() => void save(), 600);
    else void save();
  }

  async function upload(list: FileList | null) {
    const picked = Array.from(list ?? []);
    if (fileIn.current) fileIn.current.value = "";
    if (!picked.length || busy || lock) return;
    const fails: Bad[] = [];
    const added: QFile[] = [];
    setBusy("upload"); setBad([]);
    for (const [i, file] of picked.entries()) {
      if (cur.current.files.length + added.length >= max) { fails.push({ name: file.name, msg: `견적서 파일은 ${max}개까지 올릴 수 있어요.` }); continue; }
      const p = fileProblem(file, QUOTE_DOC, "PDF · 엑셀 · 사진만 올릴 수 있어요.");
      if (p) { fails.push({ name: file.name, msg: p }); continue; }
      setMsg(`견적서를 올리고 있어요 (${i + 1}/${picked.length})`);
      try {
        const fd = new FormData();
        fd.append("kind", "quote_doc");
        fd.append("file", file, file.name);
        const up = await call<Schemas["FileOut"]>("POST", "/files", fd);
        added.push({ file_id: up.id, filename: up.filename, content_type: up.content_type, size: up.size, sort: 0 });
      } catch (e) {
        fails.push({ name: file.name, msg: errorText(e) });
      }
    }
    setBusy("");
    setBad(fails);
    if (added.length) {
      change({ files: [...cur.current.files, ...added] });
      setMsg(`견적서 ${added.length}개를 올렸어요.`);
    } else setMsg("");
  }

  function remove(x: QFile) {
    change({ files: cur.current.files.filter((y) => y.file_id !== x.file_id) });
    setBad([]);
    setMsg(`‘${x.filename}’를 뺐어요.`); // 받는 확장자(pdf · xlsx · jpg · png · heic)는 모두 '를'로 읽힌다
    setTimeout(() => upBtn.current?.focus(), 0);
  }

  function move(i: number, d: -1 | 1) {
    const list = [...cur.current.files];
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    change({ files: list });
    setMsg(`‘${list[j].filename}’를 ${j + 1}번째로 옮겼어요.`);
    const id = list[j].file_id;
    setTimeout(() => {
      const want = document.getElementById(`qf-${d < 0 ? "up" : "down"}-${id}`) as HTMLButtonElement | null;
      (want && !want.disabled ? want : document.getElementById(`qf-${d < 0 ? "down" : "up"}-${id}`))?.focus();
    }, 0);
  }

  /** 쓰기 화면을 이 저장본 값으로 연다 (저장할 것이 없는 상태로) */
  function startEdit(b: Board) {
    const next = fieldsOf(b);
    cur.current = next;
    setF(next);
    done.current = edits.current;
    setStale(false);
    setErrs({}); setBad([]); setMsg(""); setActMsg(""); setSaveErr("");
    setEditing(true);
    setTimeout(() => document.getElementById("q-title")?.focus(), 0);
  }

  /** '고쳐서 다시 올리기': 고치던 저장본이 있으면 그대로, 없으면 보낸 칸으로 다음 버전 저장본을 만든다 */
  async function reopen() {
    const last = board.sent[0];
    if (reBusy || lock || !last) return;
    setNote(null); setReErr("");
    if (board.draft) { startEdit(board); return; }
    setReBusy(true);
    try {
      const out = await call<Board>("PUT", path, resendBody(last, modes));
      setBoard(out);
      startEdit(out);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && e.code === "invalid_state") { setLock(e.message); router.refresh(); }
      else setReErr(errorText(e));
    } finally {
      setReBusy(false);
    }
  }

  /** '그만 고치기': 고친 값은 저장본에 남기고 보낸 견적서 보기로 돌아간다 */
  function stopEdit() {
    void save();
    setEditing(false);
    setTimeout(() => document.getElementById("q-re")?.focus(), 0);
  }

  async function saveNow() {
    if (busy || lock) return;
    setActMsg("");
    if (await save({ force: true, focus: true })) setActMsg("임시 저장했어요.");
  }

  /** '견적서 보내기': 빠진 칸이 있으면 그 칸으로, 없으면 저장하고 고객에게 보일 모습을 확인 창으로 */
  async function ask() {
    if (busy || lock) return;
    const fl = cur.current;
    const miss: Errs = {};
    if (!fl.files.length) miss.files = MISSING.files;
    if (!fl.entered_amount) miss.entered_amount = MISSING.entered_amount;
    if (!fl.vat_mode) miss.vat_mode = MISSING.vat_mode;
    if (Object.keys(miss).length) { setErrs((m) => ({ ...m, ...miss })); focusFirst(miss); return; }
    setBusy("check"); setActMsg("");
    const ok = await save({ focus: true });
    setBusy("");
    if (!ok) return;
    setSendErr("");
    dlg.current?.showModal();
  }

  async function send() {
    if (busy) return;
    setBusy("send"); setSendErr("");
    try {
      const out = await call<Board>("POST", `${path}/send`);
      setBoard(out);
      setEditing(false);
      setNote(board.sent.length ? "실측 견적서를 다시 올렸어요." : "실측 견적서를 보냈어요.");
      dlg.current?.close();
      router.refresh();
    } catch (e) {
      if (!(e instanceof ApiError)) { setSendErr(errorText(e)); return; }
      const fe = e.status === 422 ? errsOf(e) : null;
      if (fe) { dlg.current?.close(); setErrs((m) => ({ ...m, ...fe })); focusFirst(fe); return; }
      if (e.code === "already_sent") {
        dlg.current?.close();
        setEditing(false);
        setNote(e.message);
        setBoard(await call<Board>("GET", path).catch(() => board));
        router.refresh();
        return;
      }
      if (e.status === 409 && e.code === "invalid_state") { dlg.current?.close(); setLock(e.message); return; }
      setSendErr(e.message);
    } finally {
      setBusy("");
    }
  }

  const sent = board.sent[0] ?? null;
  const closed = lock ?? (CLOSED.has(board.visit_status) ? closedText ?? "닫힌 요청이에요." : null);
  const chosen = board.visit_status === "chosen";
  const d = board.draft;
  const form = (!sent || editing) && (!closed || !!lock);
  const title = form ? (sent ? "실측 견적서 다시 올리기" : "실측 견적서 올리기") : sent ? "보낸 실측 견적서" : "실측 견적서";
  const noResend = lock ?? (chosen ? CHOSEN_TEXT : null); // 다시 올릴 수 없는 까닭 (서버 문장)
  const err = (k: Key) => (errs[k] ? `${FOCUS[k]}-e` : undefined);
  const vendorFile = (id: string) => `/api/vendor/visits/${visitId}/quote/files/${id}`;

  return (
    <>
      <div className={s.top}>
        <div className={s.headRow}>
          <div className={s.head}>
            <h1 id="q-title" className="mj-h1" tabIndex={-1}>{title}</h1>
          </div>
          {form && !lock ? (
            <p className={`mj-small mj-num ${s.stamp}`}>
              {saving ? "저장하고 있어요…" : d ? <><Check />{stampSeoul(new Date(d.updated_at))}에 임시 저장했어요</> : "아직 임시 저장하지 않았어요"}
            </p>
          ) : null}
        </div>
        {brief}
      </div>

      {note ? <DoneNote text={note} /> : null}

      {sent && !form ? (
        <section aria-labelledby="qs-sent-t" className={s.sent}>
          <div className={s.sentHead}>
            <h2 id="qs-sent-t" className="mj-sr">보낸 견적서</h2>
            {closed ? <p className="mj-st mj-st-off">{closed}</p>
              : chosen ? <p className="mj-st mj-st-ok"><Check />고객이 확정했어요</p>
              : <p className="mj-st mj-st-ok"><Check /><span className="mj-num">보냈어요 · {board.sent.length > 1 ? "다시 올렸어요 " : ""}{stampSeoul(new Date(sent.sent_at ?? sent.updated_at))}</span></p>}
          </div>
          <SentQuote q={sent} label="보낸" fileHref={vendorFile} />
          {noResend ? (
            <p role={lock ? "alert" : undefined} className={`mj-notice ${lock ? "mj-notice-warn" : ""}`}><span><b>{noResend}</b></span></p>
          ) : board.visit_status === "quoted" ? (
            <div className={s.row}>
              <button id="q-re" type="button" className="mj-btn mj-btn-pri" onClick={() => void reopen()} disabled={reBusy} aria-describedby="q-re-h">
                {reBusy ? "여는 중이에요" : d ? "이어서 고치기" : "고쳐서 다시 올리기"}
              </button>
              <p id="q-re-h" className="mj-small">고객이 확정하기 전까지 다시 올릴 수 있어요.{d ? " 고치던 내용이 임시 저장돼 있어요." : ""}</p>
            </div>
          ) : null}
          {reErr ? <FieldError id="q-re-e" alert>{reErr}</FieldError> : null}
          <div className={s.row}>
            <Link className="mj-btn mj-btn-sec" href="/vendor?tab=waiting">작업함 기다림으로 가기</Link>
            <p className="mj-small">고객이 확정하거나 다른 업체로 정하면 알림으로 알려 드려요.</p>
          </div>
        </section>
      ) : closed && !lock && !sent ? (
        <section aria-label="닫힌 요청" className={s.sent}>
          <p className="mj-notice mj-notice-warn"><span><b>{closed}</b> · 이 요청에는 견적서를 올릴 수 없어요.</span></p>
        </section>
      ) : null}

      {form ? (
        <form aria-labelledby="q-title" noValidate onSubmit={(e) => { e.preventDefault(); void ask(); }}>
          {lock ? <p role="alert" className={`mj-notice mj-notice-bad ${s.lock}`}><span><b>{lock}</b></span></p> : null}
          {sent && !lock ? (
            <div className={s.reHead}>
              <p className="mj-notice">
                <span><b>{d ? `버전 ${d.version} 고치는 중이에요` : "다음 버전 고치는 중이에요"}</b> · 다시 올리기 전까지 고객에게는 앞에 보낸 버전 {sent.version}만 보여요. 앞에 보낸 파일이 채워져 있어요. 바뀐 파일만 빼고 새로 올려요.</span>
              </p>
              <button type="button" className="mj-btn mj-btn-sec mj-btn-sm" onClick={stopEdit}>그만 고치기</button>
            </div>
          ) : null}
          <fieldset className={s.form} disabled={!!lock}>
            <section aria-labelledby="qf-t" className={`${s.col} ${s.colFiles}`}>
              <div className={s.secHead}>
                <h2 id="qf-t" className="mj-h2">견적서 파일 <span className={s.light}>(필수 · 여러 개)</span></h2>
                <p className="mj-small">내 양식 그대로 올려요. 고객에게 올린 파일 그대로, 이 순서로 보여요.</p>
              </div>
              {f.files.length ? (
                <ol className={s.files} aria-label={`올린 파일 ${f.files.length}개`}>
                  {f.files.map((x, i) => (
                    <li key={x.file_id} className={s.fl}>
                      <DocIcon />
                      <span className={s.fileName}>
                        <a href={`/api/files/${x.file_id}`} target="_blank" rel="noopener">{x.filename}<span className="mj-sr">, 새 창</span></a>
                        <span className="mj-small mj-num">{fileKind(x.content_type)} · {fileSize(x.size)}</span>
                      </span>
                      <span className={s.fileActs}>
                        {f.files.length > 1 ? (
                          <>
                            <button id={`qf-up-${x.file_id}`} type="button" className="mj-btn mj-btn-sec mj-btn-sm" disabled={i === 0 || !!lock} aria-label={`${x.filename} 위로 옮기기`} onClick={() => move(i, -1)}>위로</button>
                            <button id={`qf-down-${x.file_id}`} type="button" className="mj-btn mj-btn-sec mj-btn-sm" disabled={i === f.files.length - 1 || !!lock} aria-label={`${x.filename} 아래로 옮기기`} onClick={() => move(i, 1)}>아래로</button>
                          </>
                        ) : null}
                        <button type="button" className="mj-btn mj-btn-sec mj-btn-sm" aria-label={`${x.filename} 빼기`} disabled={!!lock} onClick={() => remove(x)}>빼기</button>
                      </span>
                    </li>
                  ))}
                </ol>
              ) : <p className={s.none}>{sent ? "다시 올릴 견적서 파일을 올려 주세요. 앞에 보낸 파일은 기록으로 남아요." : "아직 올린 견적서 파일이 없어요."}</p>}
              <div className={s.row}>
                <button ref={upBtn} id="qf-up" type="button" className="mj-btn mj-btn-sec" aria-describedby={["qf-h", err("files")].filter(Boolean).join(" ")}
                  disabled={busy === "upload" || f.files.length >= max || !!lock} onClick={() => fileIn.current?.click()}>
                  <Up />{busy === "upload" ? "올리는 중이에요" : "파일 올리기"}
                </button>
                <input ref={fileIn} type="file" multiple hidden accept={QUOTE_DOC.accept} onChange={(e) => void upload(e.target.files)} />
                <p id="qf-h" className="mj-hint">{f.files.length >= max ? `${max}개를 모두 올렸어요. 더 올리려면 하나를 빼 주세요.` : `PDF · 엑셀 · 사진 · 파일마다 ${QUOTE_DOC.mb}MB · ${max}개까지`}</p>
              </div>
              {errs.files ? <FieldError id="qf-up-e">{errs.files}</FieldError> : null}
              {bad.length ? (
                <ul className={s.bad} aria-label="올리지 못한 파일">
                  {bad.map((b, i) => <li key={i}><b>{b.name}</b><span className="mj-error">{b.msg}</span></li>)}
                </ul>
              ) : null}
              <p className="mj-small" role="status">{msg}</p>
            </section>

            <section aria-labelledby="qs-t" className={s.col}>
              <div className={s.secHead}>
                <h2 id="qs-t" className="mj-h2">견적서 요약</h2>
              </div>

              <DateField id="q-measured" label="실측한 날" past value={f.measured_on} today={today} hint="오늘까지 고를 수 있어요."
                error={errs.measured_on} disabled={!!lock} onChange={(v) => change({ measured_on: v })} />

              <div className="mj-field">
                <label htmlFor="q-amount" className="mj-label">낼 금액 <span className="mj-opt">(필수)</span></label>
                <div className={s.unit}>
                  <input id="q-amount" className="mj-input mj-num" inputMode="numeric" autoComplete="off" aria-required="true"
                    value={digitsText(f.entered_amount)} aria-invalid={errs.entered_amount ? true : undefined}
                    aria-describedby={["q-amount-h", err("entered_amount")].filter(Boolean).join(" ")}
                    onChange={(e) => change({ entered_amount: amountDigits(e.target.value) }, true)} />
                  <span aria-hidden="true">원</span>
                </div>
                <p id="q-amount-h" className="mj-hint">견적서에 적은 낼 금액을 그대로 넣어요.</p>
                {errs.entered_amount ? <FieldError id="q-amount-e">{errs.entered_amount}</FieldError> : null}
              </div>

              {modes.length > 1 ? (
                <fieldset className="mj-fieldset" aria-describedby={err("vat_mode")}>
                  <legend className="mj-label">넣은 금액은 <span className="mj-opt">(필수)</span></legend>
                  <div className={s.rads}>
                    {modes.map((m, i) => (
                      <label key={m} className={s.rad}>
                        <input id={`q-vat-${i}`} type="radio" name="q-vat" value={m} checked={f.vat_mode === m} aria-invalid={errs.vat_mode ? true : undefined}
                          onChange={() => change({ vat_mode: m })} />
                        {VAT_LABEL[m]}
                      </label>
                    ))}
                  </div>
                  {errs.vat_mode ? <FieldError id="q-vat-0-e">{errs.vat_mode}</FieldError> : null}
                </fieldset>
              ) : (
                <div className="mj-field">
                  <p className="mj-label">넣은 금액은</p>
                  <p>{VAT_LABEL[modes[0] ?? "exempt"]}</p>
                  <p className="mj-hint">면세 업체라 넣은 금액 그대로 고객에게 보여요.</p>
                </div>
              )}

              <p className={s.cust} role="status" aria-busy={stale ? true : undefined}>
                {d && d.total != null && d.vat_mode ? (
                  d.vat_mode === "exempt"
                    ? <span>고객에게는 넣은 금액 그대로 <span className={`mj-num ${s.big}`}>{won(d.total)}</span> · 면세로 보여요</span>
                    : <span>고객에게는 부가세 포함 <span className={`mj-num ${s.big}`}>{won(d.total)}</span>으로 보여요</span>
                ) : <span className="mj-sub">낼 금액을 넣고 부가세 방식을 고르면 고객에게 보일 금액이 나와요.</span>}
                {stale && !lock && d?.total != null ? <span className="mj-small">다시 계산하고 있어요</span> : null}
              </p>

              <div className="mj-field">
                <label htmlFor="q-days" className="mj-label">공사 기간 <span className="mj-opt">(선택)</span></label>
                <div className={`${s.unit} ${s.unitS}`}>
                  <input id="q-days" className="mj-input mj-num" inputMode="numeric" autoComplete="off" value={f.days}
                    aria-invalid={errs.days ? true : undefined} aria-describedby={err("days")}
                    onChange={(e) => change({ days: dayDigits(e.target.value) }, true)} />
                  <span aria-hidden="true">일</span>
                </div>
                {errs.days ? <FieldError id="q-days-e">{errs.days}</FieldError> : null}
              </div>

              <DateField id="q-valid" label="견적 유효기간" tail="까지" value={f.valid_until} today={today} hint={f.valid_until ? undefined : "고르지 않으면 기한 없이 보여요."}
                error={errs.valid_until} disabled={!!lock} onChange={(v) => change({ valid_until: v })} />

              <div className={s.acts}>
                <button type="button" className="mj-btn mj-btn-sec" onClick={() => void saveNow()} disabled={!!busy || !!lock}>임시 저장</button>
                <button id="q-send" type="submit" className="mj-btn mj-btn-pri" disabled={!!busy || !!lock}>{busy === "check" ? "확인하는 중이에요" : sent ? "다시 올리기" : "견적서 보내기"}</button>
              </div>
              {saveErr ? <FieldError id="q-err" alert>{saveErr}</FieldError> : null}
              <p className="mj-small" role="status">{actMsg}</p>
              <p className="mj-small">고객이 확정하기 전까지 다시 올릴 수 있어요.</p>
            </section>
          </fieldset>
        </form>
      ) : null}

      <dialog ref={dlg} className={s.dlg} aria-labelledby="qd-t" onClose={() => { if (form) document.getElementById("q-send")?.focus(); }}>
        <button type="button" className={s.x} aria-label="닫기" onClick={() => dlg.current?.close()}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
        </button>
        {sent ? (
          <>
            <h2 id="qd-t" className="mj-h3">견적서를 다시 올릴까요?</h2>
            {d && d.total != null && sent.total != null ? (
              <p className={`mj-num ${s.cust}`}>
                <span>고객에게 보이는 낼 금액 {won(sent.total)} → <b className={s.big}>{won(d.total)}</b> · {totalTail(d.vat_mode)}</span>
              </p>
            ) : null}
            <p>{who ? `${who} 님` : "고객"} 비교 화면에 &lsquo;다시 올렸어요&rsquo;와 올린 날짜 · 시각이 보이고 알림이 가요. 앞 파일은 기록으로 남아요.</p>
          </>
        ) : (
          <>
            <h2 id="qd-t" className="mj-h3">실측 견적서를 보낼까요?</h2>
            <p>{who ? `${who} 님에게` : "고객에게"} 이렇게 보여요. 보내면 고객에게 알림이 가요.</p>
          </>
        )}
        {d ? <SentQuote q={d} label={sent ? "다시 올릴" : "보낼"} /> : null}
        {sendErr ? <FieldError id="qd-e" alert>{sendErr}</FieldError> : null}
        <div className={s.dlgBtns}>
          <button type="button" className="mj-btn mj-btn-sec" onClick={() => dlg.current?.close()}>{sent ? "돌아가기" : "더 고치기"}</button>
          <button type="button" className="mj-btn mj-btn-pri" onClick={() => void send()} disabled={busy === "send"}>
            {busy === "send" ? (sent ? "올리는 중이에요" : "보내는 중이에요") : sent ? "다시 올리기" : "보내기"}
          </button>
        </div>
      </dialog>

      {board.sent.length > 1 ? <Versions sent={board.sent} /> : null}

      <p className={s.links}>
        <Link className="mj-lnk" href={`/vendor/requests/${visitId}`}>요청 자세히 보기</Link>
        <Link className="mj-lnk" href="/vendor">작업함으로 돌아가기</Link>
      </p>
    </>
  );
}
