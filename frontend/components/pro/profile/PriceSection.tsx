"use client";
// 03 가견적에 쓸 견적서: 공정마다 근거 파일을 올리고, 표준 행마다 단가를 직접 넣는다(부가세 빼고).
// '단가 저장하기' → PUT /vendor/prices/{trade}(고치는 중 묶음), '확인했어요' → POST .../confirm(고객 가견적에 씀).
// 고객에게 보이는 모습은 API가 계산한 example만 보인다. 화면에서 곱하거나 부가세를 붙이지 않는다.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FieldError } from "@/components/auth/parts";
import { ApiError, call, errorText, type Schemas } from "@/lib/backend/client";
import { dateSeoul, fileSize, md, stampSeoul, won } from "@/lib/format";
import { tradeLabel } from "@/lib/labels";
import { Ask } from "./Ask";
import { PRICE_DOC, digits, digitsText, fileKind, fileProblem, put, type PriceFile, type PriceSet, type Prices, type Trade } from "./text";
import s from "./Profile.module.css";

type Row = { mode: "price" | "incl"; price: string; incl: string; src: string };
type Rows = Record<string, Row>;
type Bad = { name: string; msg: string };
const PRICE_MAX = 10_000_000;

/** 고치는 중 묶음(없으면 확인한 묶음) → 칸 값 */
function rowsOf(d: Prices): Rows {
  const lines = (d.draft ?? d.confirmed)?.lines ?? [];
  return Object.fromEntries(d.rows.map((r) => {
    const ln = lines.find((x) => x.key === r.key);
    const src = ln?.source_file_id ?? "";
    if (ln?.included_in) return [r.key, { mode: "incl", price: "", incl: ln.included_in, src }];
    return [r.key, { mode: "price", price: ln?.unit_price != null ? String(ln.unit_price) : "", incl: "", src }];
  }));
}

/** 칸 값 → PUT 본문. 비운 줄은 보내지 않는다(가견적 없음). */
function linesOf(d: Prices, rs: Rows): Schemas["PriceLineIn"][] {
  return d.rows.flatMap((r): Schemas["PriceLineIn"][] => {
    const x = rs[r.key];
    const source_file_id = x.src || null;
    if (x.mode === "incl" && x.incl) return [{ key: r.key, included_in: x.incl, source_file_id }];
    if (x.mode === "price" && x.price) return [{ key: r.key, unit_price: Number(x.price), source_file_id }];
    return [];
  });
}

function check(d: Prices, rs: Rows): Record<string, string> {
  const name = (k: string) => d.rows.find((r) => r.key === k)?.name ?? k;
  const e: Record<string, string> = {};
  for (const r of d.rows) {
    const x = rs[r.key];
    if (x.mode === "incl") {
      const to = rs[x.incl];
      if (!to || to.mode !== "price" || !to.price) e[r.key] = `‘${name(x.incl)}’에 단가를 넣거나 다른 줄을 골라 주세요.`;
    } else if (x.price && Number(x.price) > PRICE_MAX) e[r.key] = "단가는 1,000만 원까지 넣을 수 있어요.";
  }
  return e;
}

const Check = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M2.5 7.5l3 3 6-7" /></svg>;
const Clock = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="7" cy="7" r="5.5" /><path d="M7 4v3.2l2 1.3" /></svg>;
const Up = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M8 11V2.5M4.5 6L8 2.5 11.5 6" /><path d="M2.5 11v2.5h11V11" /></svg>;

type Props = {
  trades: Trade[]; // 저장된 공정 (서버가 맡는 공정으로 본다)
  pending: boolean; // 화면에서 공정을 바꾸고 아직 저장하지 않음
  initial: Partial<Record<Trade, Prices>>;
  bizName: string;
  exempt: boolean;
  reload: number; // 업체 정보를 저장해 공정 · 부가세 방식이 바뀌면 늘어난다 → 다시 읽는다
};

export function PriceSection({ trades, pending, initial, bizName, exempt, reload }: Props) {
  const [tab, setTab] = useState<Trade | undefined>(trades[0]);
  const [data, setData] = useState(initial);
  const [rows, setRows] = useState<Partial<Record<Trade, Rows>>>(() => Object.fromEntries(Object.entries(initial).map(([k, d]) => [k, rowsOf(d)])));
  const [dirty, setDirty] = useState<Partial<Record<Trade, boolean>>>({});
  const [busy, setBusy] = useState<"" | "save" | "confirm" | "upload" | "remove">("");
  const [err, setErr] = useState("");
  const [rowErr, setRowErr] = useState<Record<string, string>>({});
  const [bad, setBad] = useState<Bad[]>([]);
  const [ask, setAsk] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const fileIn = useRef<HTMLInputElement>(null);
  const seen = useRef(reload);

  const tradeKey = trades.join(",");
  const t = tab && trades.includes(tab) ? tab : trades[0];
  const d = t ? data[t] : undefined;
  const rs = t ? rows[t] : undefined;

  async function load(tr: Trade, keepRows: boolean) {
    const got = await call<Prices>("GET", `/vendor/prices?trade=${tr}`);
    setData((m) => ({ ...m, [tr]: got }));
    if (!keepRows) { setRows((m) => ({ ...m, [tr]: rowsOf(got) })); setDirty((m) => ({ ...m, [tr]: false })); }
  }
  // 새로 맡은 공정이면 그 공정 단가를 읽는다. 업체 정보를 저장했으면(공정 · 부가세 방식) 다시 읽는다.
  useEffect(() => {
    const again = seen.current !== reload;
    seen.current = reload;
    for (const tr of trades) {
      if (again || !data[tr]) load(tr, !!dirty[tr] && !!rows[tr]).catch((er) => setErr(errorText(er)));
    }
  }, [tradeKey, reload]); // 읽은 단가 · 고치는 중 표시는 이 순간 값만 본다

  function pick(tr: Trade) { setTab(tr); setErr(""); setRowErr({}); setBad([]); setAsk(null); setMsg(""); }
  function onTabKey(e: React.KeyboardEvent, i: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const n = trades[(i + (e.key === "ArrowRight" ? 1 : trades.length - 1)) % trades.length];
    pick(n);
    document.getElementById(`pr-tab-${n}`)?.focus();
  }
  function edit(key: string, p: Partial<Row>) {
    if (!t || !rs) return;
    setRows((m) => ({ ...m, [t]: { ...rs, [key]: { ...rs[key], ...p } } }));
    setDirty((m) => ({ ...m, [t]: true }));
    setRowErr((m) => { const n = { ...m }; delete n[key]; return n; });
    setErr(""); setMsg("");
  }
  function apply(tr: Trade, out: Prices) {
    setData((m) => ({ ...m, [tr]: out }));
    setRows((m) => ({ ...m, [tr]: rowsOf(out) }));
    setDirty((m) => ({ ...m, [tr]: false }));
  }

  async function save(): Promise<boolean> {
    if (!t || !d || !rs || busy) return false;
    const e = check(d, rs);
    setRowErr(e);
    const first = d.rows.find((r) => e[r.key]);
    if (first) { setTimeout(() => document.getElementById(`pr-${first.key}-mode`)?.focus(), 0); return false; }
    setBusy("save"); setErr(""); setMsg("");
    try {
      apply(t, await put<Prices>(`/vendor/prices/${t}`, { lines: linesOf(d, rs) }));
      setMsg(`저장했어요 · ${stampSeoul(new Date())}`);
      return true;
    } catch (er) {
      setErr(errorText(er));
      return false;
    } finally { setBusy(""); }
  }

  async function confirm() {
    if (!t || busy) return;
    if (dirty[t] && !(await save())) return;
    setBusy("confirm"); setErr(""); setMsg("");
    try {
      apply(t, await call<Prices>("POST", `/vendor/prices/${t}/confirm`));
    } catch (er) {
      setErr(errorText(er));
      if (er instanceof ApiError && er.code === "invalid_state") await load(t, false).catch(() => undefined);
    } finally { setBusy(""); }
  }

  async function upload(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (fileIn.current) fileIn.current.value = "";
    if (!t || !files.length || busy) return;
    const fails: Bad[] = [];
    let added = 0;
    setBusy("upload"); setErr(""); setBad([]); setAsk(null);
    for (const [i, f] of files.entries()) {
      const p = fileProblem(f, PRICE_DOC, "PDF · 엑셀 · 사진만 올릴 수 있어요.");
      if (p) { fails.push({ name: f.name, msg: p }); continue; }
      setMsg(`견적서를 올리고 있어요 (${i + 1}/${files.length})`);
      try {
        const fd = new FormData();
        fd.append("kind", "price_doc");
        fd.append("file", f, f.name);
        const up = await call<Schemas["FileOut"]>("POST", "/files", fd);
        const pf = await call<PriceFile>("POST", "/vendor/price-files", { file_id: up.id, trade: t });
        setData((m) => { const cur = m[t]; return cur ? { ...m, [t]: { ...cur, files: [...cur.files, pf] } } : m; });
        added++;
      } catch (er) {
        if (er instanceof ApiError && (er.code === "trade_not_mine" || er.code === "too_many_files")) { setErr(er.message); break; }
        fails.push({ name: f.name, msg: errorText(er) });
      }
    }
    setBad(fails);
    setMsg(added ? `견적서 ${added}개를 올렸어요.` : "");
    setBusy("");
  }

  async function removeFile(f: PriceFile) {
    if (!t || busy) return;
    setBusy("remove"); setErr("");
    try {
      await call("DELETE", `/vendor/price-files/${f.file_id}`);
      // 서버도 그 파일을 근거로 고른 줄의 근거만 비운다(단가는 그대로)
      const keep = !!dirty[t];
      if (keep) setRows((m) => { const cur = m[t]; return cur ? { ...m, [t]: Object.fromEntries(Object.entries(cur).map(([k, r]) => [k, r.src === f.file_id ? { ...r, src: "" } : r])) } : m; });
      await load(t, keep);
      setMsg(`‘${f.filename}’를 뺐어요.`); // 받을 수 있는 확장자(pdf · xlsx · jpg · png · heic)는 모두 '를'로 읽힌다
      setTimeout(() => document.getElementById("pr-up")?.focus(), 0);
    } catch (er) {
      setErr(errorText(er));
    } finally { setBusy(""); setAsk(null); }
  }

  if (!t) {
    return <p className="mj-sub">하는 공정을 고르고 저장하면 공정마다 단가를 넣을 수 있어요.</p>;
  }
  const label = tradeLabel(t);
  const files = d?.files ?? [];
  const editing = !!d?.draft || !!dirty[t];
  const conf = d?.confirmed;
  const name = (k: string) => d?.rows.find((r) => r.key === k)?.name ?? k;
  const exLine = (x: PriceSet) => (!x.example.lines.length || x.example.missing.length
    ? <span>{bizName} · <b>가견적 없음 · 실측 뒤 금액</b> <span className="mj-small">비워 둔 줄이 있어서요</span></span>
    : <span>{bizName} 가견적 <strong className={`mj-num ${s.big}`}>{won(x.example.total)}</strong> <span className="mj-small">{exempt ? "면세" : "부가세 포함"}</span></span>);

  return (
    <div className={s.priceBox} onKeyDown={(e) => {
      const el = e.target as HTMLInputElement;
      if (e.key === "Enter" && el.tagName === "INPUT" && el.type !== "file") { e.preventDefault(); void save(); }
    }}>
      {trades.length > 1 ? (
        <div className="mj-tabs" role="tablist" aria-label="공정">
          {trades.map((tr, i) => (
            <button key={tr} id={`pr-tab-${tr}`} type="button" role="tab" aria-selected={tr === t} aria-controls="pr-panel" tabIndex={tr === t ? 0 : -1}
              onClick={() => pick(tr)} onKeyDown={(e) => onTabKey(e, i)}>
              {tradeLabel(tr)}{dirty[tr] ? <span className="mj-small">· 저장 안 함</span> : null}
            </button>
          ))}
        </div>
      ) : null}
      {pending ? <p className="mj-notice"><span>하는 공정을 바꿨어요. 맨 아래 &lsquo;저장하기&rsquo;를 누르면 여기 공정도 바뀌어요.</span></p> : null}

      <div id="pr-panel" className={s.panel} role={trades.length > 1 ? "tabpanel" : undefined} aria-labelledby={trades.length > 1 ? `pr-tab-${t}` : undefined}>
        {!d ? <p className="mj-sub" role="status">{label} 단가를 불러오는 중이에요…</p> : (
          <>
            {/* 근거 파일 */}
            <div className={s.stack}>
              {files.length ? null : <p>아직 올린 {label} 견적서가 없어요.</p>}
              <div className={s.row}>
                <button id="pr-up" type="button" className="mj-btn mj-btn-sec" aria-describedby="pr-up-h pr-mask" onClick={() => fileIn.current?.click()} disabled={!!busy}>
                  <Up />견적서 올리기
                </button>
                <input ref={fileIn} type="file" multiple hidden accept={PRICE_DOC.accept} onChange={(e) => upload(e.target.files)} />
                {files.length ? <p id="pr-up-h" className="mj-hint">PDF · 엑셀 · 사진(JPG · PNG · HEIC) · 여러 개 · 파일마다 {PRICE_DOC.mb}MB · 공정마다 10개까지</p>
                  : <Link className="mj-lnk" href="/vendor">처음 할 일로</Link>}
              </div>
              {files.length ? null : <p id="pr-up-h" className="mj-small">안 올리면 고객 목록에 &lsquo;가견적 없음 · 실측 뒤 금액&rsquo;으로 보여요. PDF · 엑셀 · 사진, 파일마다 {PRICE_DOC.mb}MB까지 올릴 수 있어요.</p>}
              <p id="pr-mask" className={`mj-notice mj-notice-warn ${s.mask}`}><span>고객 이름 · 주소는 가리고 올려 주세요.</span></p>
              {bad.length ? (
                <ul className={s.bad} aria-label="올리지 못한 파일">
                  {bad.map((b, i) => (
                    <li key={i} className={s.fileRow}>
                      <span className={s.fileName}><b>{b.name}</b><span className="mj-error">{b.msg}</span></span>
                      <button type="button" className="mj-btn mj-btn-sec mj-btn-sm" aria-label={`${b.name} 대신 다시 고르기`} onClick={() => fileIn.current?.click()}>다시 고르기</button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            {files.length ? (
              <ul className={s.files} aria-label={`올린 ${label} 견적서 ${files.length}개`}>
                {files.map((f) => (
                  <li key={f.file_id}>
                    <div className={s.fileRow}>
                      <svg width="28" height="34" viewBox="0 0 28 34" fill="none" aria-hidden="true" style={{ flex: "none" }}><path d="M2 1.5h16l8 8v23H2z" fill="var(--bg)" stroke="var(--line-strong)" strokeWidth="1.5" strokeLinejoin="round" /><path d="M18 1.5v8h8" stroke="var(--line-strong)" strokeWidth="1.5" strokeLinejoin="round" /><path d="M7 17h14M7 22h14M7 27h9" stroke="var(--line-paper)" strokeWidth="1.5" /></svg>
                      <span className={s.fileName}>
                        <a href={`/api/files/${f.file_id}`} target="_blank" rel="noopener">{f.filename}</a>
                        <span className="mj-small mj-num">{fileKind(f.content_type)} · {fileSize(f.size)} · {md(dateSeoul(f.created_at))} 올림</span>
                      </span>
                      <button id={`pr-x-${f.file_id}`} type="button" className="mj-btn mj-btn-sec mj-btn-sm" aria-label={`${f.filename} 빼기`} aria-expanded={ask === f.file_id}
                        onClick={() => setAsk(f.file_id)} disabled={!!busy}>빼기</button>
                    </div>
                    {ask === f.file_id ? (
                      <Ask text={`‘${f.filename}’를 뺄까요? 이 파일을 근거로 고른 줄은 근거만 비워지고 단가는 그대로예요.`}
                        yes="파일 빼기" busy={busy === "remove"} back={`pr-x-${f.file_id}`} onYes={() => removeFile(f)} onNo={() => setAsk(null)} />
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}

            {/* 단가 표 */}
            <div className={s.stack}>
              <div className={s.row}>
                <h3 className={s.h3}>항목별 단가</h3>
                <p className="mj-small">{label}{t === "dobae" ? " · 도배지는 기본형 · 저가형을 따로 넣어요" : ""}</p>
              </div>
              <p id="pr-vat" className="mj-hint">{exempt ? "면세 업체라 넣은 단가 그대로 고객 가견적을 계산해요." : "부가세 빼고 적어요."}</p>
              <table className={`${s.ptable} mj-num`}>
                <caption className="mj-sr">{label} 항목별 단가. 단가는 원, 부가세 빼고</caption>
                <thead><tr><th scope="col">항목</th><th scope="col">단위</th><th scope="col">단가(원)</th><th scope="col">참고한 파일 (선택)</th></tr></thead>
                <tbody>
                  {d.rows.map((r) => {
                    const x = rs?.[r.key] ?? { mode: "price" as const, price: "", incl: "", src: "" };
                    const others = d.rows.filter((o) => o.key !== r.key);
                    const e = rowErr[r.key];
                    return (
                      <tr key={r.key}>
                        <th scope="row">{r.name}</th>
                        <td className={s.unitCell}>{r.unit}</td>
                        <td>
                          <div className={s.priceCell}>
                            <span className={s.cellLab} aria-hidden="true">단가 · {r.unit}당</span>
                            <label htmlFor={`pr-${r.key}-mode`} className="mj-sr">{r.name} 넣는 방식</label>
                            <select id={`pr-${r.key}-mode`} className="mj-select" value={x.mode === "incl" ? x.incl : ""}
                              aria-invalid={e ? true : undefined} aria-describedby={e ? `pr-${r.key}-e` : undefined}
                              onChange={(ev) => edit(r.key, ev.target.value ? { mode: "incl", incl: ev.target.value } : { mode: "price", incl: "" })}>
                              <option value="">단가를 넣어요</option>
                              {others.map((o) => <option key={o.key} value={o.key}>{o.name}에 포함</option>)}
                            </select>
                            {x.mode === "price" ? (
                              <div className={s.unit}>
                                <label htmlFor={`pr-${r.key}`} className="mj-sr">{r.name} 단가, {r.unit}당 원</label>
                                <input id={`pr-${r.key}`} className={`mj-input mj-num ${s.priceIn}`} inputMode="numeric" autoComplete="off" placeholder="비워 둠"
                                  value={digitsText(x.price)} onChange={(ev) => edit(r.key, { price: digits(ev.target.value) })} aria-describedby="pr-vat" />
                                <span aria-hidden="true">원</span>
                              </div>
                            ) : <span className="mj-small">{name(x.incl)}에 포함 · 0원</span>}
                            {e ? <div className={s.rowErr}><FieldError id={`pr-${r.key}-e`}>{e}</FieldError></div> : null}
                          </div>
                        </td>
                        <td>
                          <span className={s.cellLab} aria-hidden="true">참고한 파일</span>
                          <label htmlFor={`pr-${r.key}-src`} className="mj-sr">{r.name} 참고한 파일</label>
                          <select id={`pr-${r.key}-src`} className={`mj-select ${s.srcSel}`} value={files.some((f) => f.file_id === x.src) ? x.src : ""}
                            disabled={!files.length} onChange={(ev) => edit(r.key, { src: ev.target.value })}>
                            <option value="">{files.length ? "고르지 않음" : "올린 파일이 없어요"}</option>
                            {files.map((f) => <option key={f.file_id} value={f.file_id}>{f.filename}</option>)}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 저장 · 확인 */}
            <div className={s.stack}>
              {err ? <FieldError id="pr-err" alert>{err}</FieldError> : null}
              <div className={s.row}>
                <button type="button" className="mj-btn mj-btn-sec" onClick={() => void save()} disabled={!!busy || !dirty[t]}>{busy === "save" ? "저장하는 중이에요" : "단가 저장하기"}</button>
                <button type="button" className="mj-btn mj-btn-pri" aria-describedby="pr-ok-h" onClick={() => void confirm()} disabled={!!busy || !editing}>{busy === "confirm" ? "확인하는 중이에요" : "확인했어요"}</button>
                {editing
                  ? <p className={`mj-st mj-st-wait ${s.status}`}><Clock />고친 단가는 &lsquo;확인했어요&rsquo;를 눌러야 고객에게 보여요</p>
                  : conf?.confirmed_at
                    ? <p className="mj-st mj-st-ok"><Check />확인했어요 · <span className="mj-num">{stampSeoul(new Date(conf.confirmed_at))}</span></p>
                    : <p className={`mj-st mj-st-off ${s.status}`}>아직 확인한 단가가 없어요</p>}
              </div>
              <p className="mj-small" role="status">{msg}</p>
              <p id="pr-ok-h" className="mj-small">확인한 단가로만 고객 가견적을 계산해요. 확인 전에는 고객에게 가견적이 안 보여요.</p>
              {editing && conf?.confirmed_at ? <p className="mj-small">지금 고객에게는 <span className="mj-num">{stampSeoul(new Date(conf.confirmed_at))}</span>에 확인한 단가로 보여요. 이미 실측을 요청한 고객의 가견적은 그때 값으로 남아요.</p> : null}
            </div>

            {d.confirmed || d.draft ? (
              <div role="group" aria-labelledby="pr-ex-t" className={s.card}>
                <p id="pr-ex-t" className="mj-small">고객에게 보이는 모습 · 32평 아파트 예</p>
                {d.confirmed ? <p>{exLine(d.confirmed)}</p> : <p className="mj-sub">확인한 단가가 없어 아직 고객에게 가견적이 안 보여요.</p>}
                {d.draft ? <p><span className="mj-small">&lsquo;확인했어요&rsquo;를 누르면 · </span>{exLine(d.draft)}</p> : null}
                <p className="mj-small">{dirty[t] ? "고친 단가는 저장하면 여기에 반영돼요." : "업체 견적서 단가로 믿집이 계산했어요"}</p>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
