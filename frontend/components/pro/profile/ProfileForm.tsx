"use client";
// 업체 정보 (시안 WVProfile): 01 기본 정보 · 02 하는 공정 · 03 가견적에 쓸 견적서 · 04 실측 방식 · 05 시공 사진 · 링크.
// 01 · 02 · 04 · 05는 맨 아래 '저장하기' 하나로 PUT /vendor/profile에 통째로 보낸다. 읽은 updated_at이 다르면 409.
// 03은 따로 저장한다(PriceSection). 시공 사진 올리기 · 빼기는 누르면 바로 반영되고, 사진 설명만 '저장하기'로 보낸다.
// 상호 · 대표자 · 사업자등록번호는 심사 대상이라 읽기만 한다.
import { useEffect, useRef, useState } from "react";
import { FieldError, PHONE_MSG, phoneOk } from "@/components/auth/parts";
import type { Region } from "@/lib/api/project";
import { ApiError, call, errorText, type Schemas } from "@/lib/backend/client";
import { dateSeoul, eulReul, md, stampSeoul } from "@/lib/format";
import { tradeLabel } from "@/lib/labels";
import { Ask } from "./Ask";
import { PriceSection } from "./PriceSection";
import {
  CALL_END, CALL_START, FAQS, METHODS, TRADE_DESC, TRADE_KEYS, WORK_PHOTO,
  bizNoText, contactLine, digits, digitsText, fileProblem, put,
  type FaqKey, type Method, type Photo, type Prices, type Profile, type ProfileBody, type Trade,
} from "./text";
import s from "./Profile.module.css";

type LinkRow = { key: string; label: string | null; url: string };
type F = {
  phone: string; areas: string[]; trades: Trade[];
  address: string; license: string; insurance: string;
  method: Method | ""; contactUrl: string; callStart: string; callEnd: string;
  fee: "" | "free" | "paid"; feeWon: string; refund: boolean; tax: "general" | "exempt";
  faqs: Record<FaqKey, string>; links: LinkRow[]; site: string; photos: Photo[];
};
type Errs = Record<string, string>;
type Bad = { name: string; msg: string };

const LINKS_MAX = 5;
const PHOTO_MAX = 20;
const FEE_MAX = 1_000_000;
const NEW_TITLE = "시공 사진"; // 올린 뒤 설명을 고쳐 저장한다
const URL_MSG = "주소를 확인해 주세요. 예: https://www.example.com";
const urlOk = (v: string) => { const x = v.trim(); return x.length <= 300 && !/\s/.test(x) && /^(https?:\/\/)?[^/\s.]+\.[^\s]+$/i.test(x); };
let seq = 0;
const lk = () => `ln${++seq}`;

function fromProfile(p: Profile): F {
  return {
    phone: p.phone ?? "", areas: p.areas.map((a) => `${a.sido}/${a.sgg}`), trades: TRADE_KEYS.filter((t) => p.trades.includes(t)),
    address: p.address ?? "", license: p.interior_license ?? "", insurance: p.insurance ?? "",
    method: METHODS.find((m) => m.key === p.contact_method)?.key ?? "",
    contactUrl: p.contact_url ?? "", callStart: p.call_start?.slice(0, 5) ?? "", callEnd: p.call_end?.slice(0, 5) ?? "",
    fee: p.visit_fee == null ? "" : p.visit_fee > 0 ? "paid" : "free", feeWon: p.visit_fee ? String(p.visit_fee) : "", refund: p.visit_fee_refund,
    tax: p.tax_kind === "exempt" ? "exempt" : "general",
    faqs: Object.fromEntries(FAQS.map((q) => [q.key, p.faqs.find((x) => x.key === q.key)?.answer ?? ""])) as Record<FaqKey, string>,
    links: p.links.map((l) => ({ key: lk(), label: l.label ?? null, url: l.url })),
    site: p.site_url ?? "", photos: p.portfolio,
  };
}

function check(f: F): Errs {
  const e: Errs = {};
  if (!phoneOk(f.phone)) e.phone = PHONE_MSG;
  if (!f.areas.length) e.areas = "활동 지역을 하나 이상 골라 주세요.";
  if (!f.trades.length) e.trades = "공정을 하나 이상 골라 주세요.";
  if (!f.method) e.method = "연락 방식을 골라 주세요.";
  else if ((f.method === "kakao" || f.method === "web") && !f.contactUrl.trim()) e.contactUrl = f.method === "kakao" ? "카카오톡 채널을 골랐어요. 채널 주소를 넣어 주세요." : "홈페이지 상담을 골랐어요. 상담 주소를 넣어 주세요.";
  else if ((f.method === "kakao" || f.method === "web") && !urlOk(f.contactUrl)) e.contactUrl = URL_MSG;
  if (!f.callStart !== !f.callEnd) e.call = "통화 가능 시간은 시작과 끝을 함께 골라 주세요.";
  else if (f.callStart && f.callStart >= f.callEnd) e.call = "통화 가능 시간의 끝을 시작보다 늦게 골라 주세요.";
  if (!f.fee) e.fee = "실측 비용을 골라 주세요.";
  else if (f.fee === "paid" && !(Number(f.feeWon) > 0)) e.fee = "출장비를 넣어 주세요. 받지 않으면 '무료'를 골라요.";
  else if (f.fee === "paid" && Number(f.feeWon) > FEE_MAX) e.fee = "출장비는 100만 원까지 넣을 수 있어요.";
  f.photos.forEach((p, i) => { if (!p.title.trim()) e[`photo${i}`] = "사진 설명을 적어 주세요."; });
  f.links.forEach((l, i) => { if (l.url.trim() && !urlOk(l.url)) e[`link${i}`] = URL_MSG; });
  if (f.site.trim() && !urlOk(f.site)) e.site = URL_MSG;
  return e;
}

function toBody(f: F, updatedAt: string | null): ProfileBody {
  const paid = f.fee === "paid";
  const url = f.method === "kakao" || f.method === "web";
  return {
    updated_at: updatedAt,
    phone: f.phone.trim(),
    address: f.address.trim() || null,
    site_url: f.site.trim() || null,
    trades: f.trades,
    areas: f.areas.map((a) => { const [sido, sgg] = a.split("/"); return { sido, sgg }; }),
    contact_method: f.method as Method,
    contact_url: url ? f.contactUrl.trim() : null,
    call_start: f.callStart || null,
    call_end: f.callEnd || null,
    visit_fee: paid ? Number(f.feeWon) : 0,
    visit_fee_refund: paid && f.refund,
    tax_kind: f.tax,
    interior_license: f.license.trim() || null,
    insurance: f.insurance.trim() || null,
    faqs: FAQS.filter((q) => f.faqs[q.key].trim()).map((q) => ({ key: q.key, answer: f.faqs[q.key].trim() })),
    links: f.links.filter((l) => l.url.trim()).map((l) => ({ label: l.label, url: l.url.trim() })),
    portfolio: f.photos.map((p) => ({ id: p.id, title: p.title.trim(), space: p.space ?? null, pyeong: p.pyeong ?? null, taken_on: p.taken_on ?? null })),
  };
}

// API 오류 → 칸. 422 fields의 loc은 본문 칸 이름(backend/app/vendor/schemas.py ProfileIn)
const LOC: Record<string, string> = {
  phone: "phone", address: "address", interior_license: "license", insurance: "insurance", areas: "areas", trades: "trades",
  contact_method: "method", contact_url: "contactUrl", call_start: "call", call_end: "call", visit_fee: "fee", visit_fee_refund: "fee", tax_kind: "tax", site_url: "site",
};
function apiErrs(er: unknown, f: F): Errs {
  if (!(er instanceof ApiError)) return { form: errorText(er) };
  if (er.code === "region") return { areas: er.message };
  const sentFaq = FAQS.filter((q) => f.faqs[q.key].trim());
  const sentLink = f.links.map((l, i) => [l, i] as const).filter(([l]) => l.url.trim()).map(([, i]) => i);
  const out: Errs = {};
  for (const x of er.fields ?? []) {
    const [a, i] = x.loc;
    const n = Number(i);
    const k = a === "faqs" && sentFaq[n] ? `faq_${sentFaq[n].key}` : a === "links" && sentLink[n] != null ? `link${sentLink[n]}` : a === "portfolio" ? `photo${n}` : (LOC[a] ?? "form");
    out[k] ??= /[가-힣]/.test(x.msg) ? x.msg : er.message;
  }
  return Object.keys(out).length ? out : { form: er.message };
}

const SEL: Record<string, string> = {
  phone: "#vp-phone", address: "#vp-address", license: "#vp-license", insurance: "#vp-insurance", areas: "#vp-areas input[type='checkbox']",
  trades: "#vp-t-dobae", method: "[name='vp-method']", contactUrl: "#vp-curl", call: "#vp-call-from", fee: "[name='vp-fee']", tax: "[name='vp-tax']", site: "#vp-site", form: "#vp-form-err",
};
const selOf = (k: string) => (k.startsWith("faq_") ? `#vp-${k}` : k.startsWith("photo") ? `#vp-ph-${k.slice(5)}` : k.startsWith("link") ? `#vp-link-${k.slice(4)}` : SEL[k]);

function areaLabel(regions: Region[], v: string) {
  const [sido, sgg] = v.split("/");
  const r = regions.find((x) => x.id === sido);
  const g = r?.groups.find((x) => x.items.includes(sgg));
  return `${g?.prefix || r?.name || sido} ${sgg}`;
}

const Check = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M2.5 7.5l3 3 6-7" /></svg>;
const Up = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M8 11V2.5M4.5 6L8 2.5 11.5 6" /><path d="M2.5 11v2.5h11V11" /></svg>;
const SECTIONS = [
  { id: "basic", no: "01", title: "기본 정보" },
  { id: "trades", no: "02", title: "하는 공정" },
  { id: "prices", no: "03", title: "가견적에 쓸 견적서" },
  { id: "visit", no: "04", title: "실측 방식" },
  { id: "photos", no: "05", title: "시공 사진 · 링크" },
];

type Props = { profile: Profile; regions: Region[]; prices: Partial<Record<Trade, Prices>> };

export function ProfileForm({ profile, regions, prices }: Props) {
  const [saved, setSaved] = useState(profile);
  const [f, setF] = useState(() => fromProfile(profile));
  const [tried, setTried] = useState(false);
  const [server, setServer] = useState<Errs>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const [stale, setStale] = useState(false);
  const [reload, setReload] = useState(0);
  const [sido, setSido] = useState(() => f.areas[0]?.split("/")[0] ?? regions[0]?.id ?? "seoul");
  const [askTrade, setAskTrade] = useState<Trade | null>(null);
  const [askPhoto, setAskPhoto] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState<"" | "up" | "x">("");
  const [photoMsg, setPhotoMsg] = useState("");
  const [photoBad, setPhotoBad] = useState<Bad[]>([]);
  const photoIn = useRef<HTMLInputElement>(null);
  const [focusTo, setFocusTo] = useState<{ k: string; n: number } | null>(null);

  const errs: Errs = { ...(tried ? check(f) : {}), ...server };
  const set = (p: Partial<F>) => { setF((x) => ({ ...x, ...p })); setServer({}); setDone(""); };
  const err = (k: string) => (errs[k] ? <FieldError id={`vp-e-${k}`}>{errs[k]}</FieldError> : null);
  const inv = (k: string, hint?: string) => ({ "aria-invalid": errs[k] ? (true as const) : undefined, "aria-describedby": [hint, errs[k] ? `vp-e-${k}` : ""].filter(Boolean).join(" ") || undefined });
  const desc = (k: string, hint?: string) => [hint, errs[k] ? `vp-e-${k}` : ""].filter(Boolean).join(" ") || undefined;
  const savedTrades = TRADE_KEYS.filter((t) => saved.trades.includes(t));
  const pending = f.trades.join(",") !== savedTrades.join(",");
  const region = regions.find((r) => r.id === sido);
  const elsewhere = f.areas.filter((a) => a.split("/")[0] !== sido).map((a) => areaLabel(regions, a));
  const urlNeeded = f.method === "kakao" || f.method === "web";
  const lastSaved = saved.updated_at ? stampSeoul(new Date(saved.updated_at)) : "아직 저장하지 않았어요";

  // 오류 칸으로 초점: 오류 문장이 그려진 뒤(effect)에 옮긴다
  useEffect(() => {
    if (!focusTo) return;
    document.querySelector<HTMLElement>(selOf(focusTo.k) ?? SEL.form)?.focus();
  }, [focusTo]);
  function focusFirst(e: Errs) {
    const order = ["phone", "address", "license", "insurance", "areas", "trades", "method", "contactUrl", "call", "fee", "tax",
      ...FAQS.map((q) => `faq_${q.key}`), ...f.photos.map((_, i) => `photo${i}`), ...f.links.map((_, i) => `link${i}`), "site", "form"];
    const k = order.find((x) => e[x]) ?? Object.keys(e)[0];
    if (k) setFocusTo((o) => ({ k, n: (o?.n ?? 0) + 1 }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setTried(true);
    const found = check(f);
    if (Object.keys(found).length) { setServer({}); focusFirst(found); return; }
    setBusy(true); setDone(""); setServer({});
    try {
      const out = await put<Profile>("/vendor/profile", toBody(f, saved.updated_at));
      if (out.tax_kind !== saved.tax_kind) setReload((n) => n + 1);
      setSaved(out);
      setF(fromProfile(out));
      setTried(false);
      setDone(`저장했어요 · ${out.updated_at ? stampSeoul(new Date(out.updated_at)) : stampSeoul(new Date())}`);
    } catch (er) {
      const x = apiErrs(er, f);
      if (er instanceof ApiError && er.code === "stale") setStale(true);
      setServer(x);
      focusFirst(x);
    } finally { setBusy(false); }
  }

  function toggleArea(v: string, on: boolean) { set({ areas: on ? [...f.areas, v] : f.areas.filter((x) => x !== v) }); }
  function toggleTrade(t: Trade, on: boolean) {
    if (on) { setAskTrade(null); set({ trades: TRADE_KEYS.filter((x) => x === t || f.trades.includes(x)) }); }
    else if (savedTrades.includes(t)) setAskTrade(t);
    else set({ trades: f.trades.filter((x) => x !== t) });
  }
  function setPhoto(id: string, title: string) {
    setF((x) => ({ ...x, photos: x.photos.map((p) => (p.id === id ? { ...p, title } : p)) }));
    setServer({}); setDone("");
  }

  async function addPhotos(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (photoIn.current) photoIn.current.value = "";
    if (!files.length || photoBusy) return;
    const fails: Bad[] = [];
    let count = f.photos.length;
    let added = 0;
    setPhotoBusy("up"); setPhotoBad([]); setAskPhoto(null);
    for (const [i, file] of files.entries()) {
      const p = fileProblem(file, WORK_PHOTO, "JPG · PNG · WebP 사진만 올릴 수 있어요.");
      if (p) { fails.push({ name: file.name, msg: p }); continue; }
      if (count >= PHOTO_MAX) { fails.push({ name: file.name, msg: `시공 사진은 ${PHOTO_MAX}장까지 올릴 수 있어요.` }); continue; }
      setPhotoMsg(`사진을 올리고 있어요 (${i + 1}/${files.length})`);
      try {
        const fd = new FormData();
        fd.append("kind", "portfolio");
        fd.append("file", file, file.name);
        const up = await call<Schemas["FileOut"]>("POST", "/files", fd);
        const ph = await call<Photo>("POST", "/vendor/portfolio", { file_id: up.id, title: NEW_TITLE });
        setF((x) => ({ ...x, photos: [...x.photos, ph] }));
        count++; added++;
      } catch (er) {
        fails.push({ name: file.name, msg: errorText(er) });
        if (er instanceof ApiError && er.code === "portfolio_full") break;
      }
    }
    setPhotoBad(fails);
    setPhotoMsg(added ? `사진 ${added}장을 올렸어요. 사진 설명을 고친 뒤 저장해 주세요.` : "");
    setPhotoBusy("");
  }

  async function removePhoto(p: Photo) {
    if (photoBusy) return;
    setPhotoBusy("x"); setPhotoBad([]);
    try {
      await call("DELETE", `/vendor/portfolio/${p.id}`);
      setF((x) => ({ ...x, photos: x.photos.filter((y) => y.id !== p.id) }));
      setServer({});
      setPhotoMsg("사진을 뺐어요. 고객 화면에서도 사라졌어요.");
      setTimeout(() => document.getElementById("vp-ph-up")?.focus(), 0);
    } catch (er) {
      setPhotoBad([{ name: p.title, msg: errorText(er) }]);
    } finally { setPhotoBusy(""); setAskPhoto(null); }
  }

  function addLink() {
    if (f.links.length >= LINKS_MAX) return;
    set({ links: [...f.links, { key: lk(), label: null, url: "" }] });
    setTimeout(() => document.getElementById(`vp-link-${f.links.length}`)?.focus(), 0);
  }

  const feeN = f.fee === "paid" ? Number(f.feeWon) : 0;
  const preview = f.method && f.fee && !(f.fee === "paid" && !feeN) ? contactLine(f.method, f.callStart, f.callEnd, feeN) : "";
  const startOpts = f.callStart && !CALL_START.includes(f.callStart) ? [f.callStart, ...CALL_START] : CALL_START;
  const endOpts = f.callEnd && !CALL_END.includes(f.callEnd) ? [...CALL_END, f.callEnd] : CALL_END;

  return (
    <main id="main">
      <form className={s.form} onSubmit={save} noValidate aria-labelledby="vp-t">
        <div className={`mj-wrap ${s.top}`}>
          <div className={s.titleRow}>
            <h1 id="vp-t" className="mj-h1">업체 정보</h1>
          </div>
          <nav className={s.toc} aria-label="이 화면 목차">
            <ul>{SECTIONS.map((x) => <li key={x.id}><a href={`#${x.id}`}><span className="mj-code" aria-hidden="true">{x.no}</span>{x.title}</a></li>)}</ul>
          </nav>
        </div>

        {/* 01 기본 정보 */}
        <div className="mj-wrap">
          <section id="basic" className={`mj-sec ${s.sec}`} aria-labelledby="s1-t">
            <div className="mj-sec-l"><p className="mj-code" aria-hidden="true">01</p><h2 id="s1-t" className="mj-h2">기본 정보</h2></div>
            <div className="mj-sec-c" style={{ gap: 24 }}>
              <div className={s.grid}>
                <div className="mj-field"><label className="mj-label" htmlFor="vp-name">상호</label><input id="vp-name" className={`mj-input ${s.ro}`} value={saved.biz_name ?? ""} readOnly /></div>
                <div className="mj-field"><label className="mj-label" htmlFor="vp-owner">대표자 이름</label><input id="vp-owner" className={`mj-input ${s.ro}`} value={saved.owner_name ?? ""} readOnly /></div>
              </div>
              <div className="mj-field">
                <label className="mj-label" htmlFor="vp-biz">사업자등록번호</label>
                <div className={s.row}>
                  <input id="vp-biz" className={`mj-input mj-num ${s.ro}`} style={{ flex: "0 1 260px" }} value={bizNoText(saved.biz_no)} readOnly aria-describedby={saved.verified_at ? "vp-biz-st" : undefined} />
                  {saved.verified_at ? <span id="vp-biz-st" className="mj-st mj-st-ok"><Check />믿집 확인 · <span className="mj-num">{md(dateSeoul(saved.verified_at))}</span></span> : null}
                </div>
              </div>
              <p className="mj-small">상호 · 대표자 · 사업자등록번호를 바꾸려면 고객센터에 문의해 주세요.</p>
              <div className={`mj-field ${s.narrow}`}>
                <label className="mj-label" htmlFor="vp-phone">휴대폰 <span className={s.opt}>(필수)</span></label>
                <input id="vp-phone" className="mj-input mj-num" type="tel" inputMode="tel" autoComplete="tel" value={f.phone} onChange={(e) => set({ phone: e.target.value })} {...inv("phone", "vp-phone-h")} />
                <p id="vp-phone-h" className="mj-hint">실측을 요청한 고객에게 보여요.</p>
                {err("phone")}
              </div>
              <fieldset id="vp-areas" aria-describedby={desc("areas")}>
                <legend className={s.leg}>활동 지역 <span className={s.opt}>(필수 · 하나 이상)</span></legend>
                <div className={s.stack}>
                  <label htmlFor="vp-sido" className="mj-sr">시 · 도</label>
                  <select id="vp-sido" className={`mj-select ${s.sido}`} value={sido} onChange={(e) => setSido(e.target.value)}>
                    {regions.map((r) => <option key={r.id} value={r.id}>{r.full}</option>)}
                  </select>
                  {region?.groups.map((g, gi) => (
                    <div key={g.prefix || gi} className={s.stack}>
                      {region.groups.length > 1 && g.label ? <p className="mj-small">{g.label}</p> : null}
                      <div className={s.ckg}>
                        {g.items.map((n) => {
                          const v = `${sido}/${n}`;
                          return <label key={v} className={s.ck}><input type="checkbox" name="vp-area" value={v} checked={f.areas.includes(v)} onChange={(e) => toggleArea(v, e.target.checked)} />{n}</label>;
                        })}
                      </div>
                    </div>
                  ))}
                  {regions.length ? null : <p className="mj-small">지역 목록을 불러오지 못했어요. 새로 고쳐 주세요.</p>}
                  {elsewhere.length ? <p className="mj-small">다른 시 · 도에서 고른 곳 · {elsewhere.join(" · ")}</p> : null}
                </div>
                {err("areas")}
              </fieldset>
              <div className={s.block}>
                <h3 className={s.h3}>사업장 · 자격 <span className={s.opt}>(선택)</span></h3>
                <div className={`mj-field ${s.narrow}`}>
                  <label className="mj-label" htmlFor="vp-address">사업장 주소</label>
                  <input id="vp-address" className="mj-input" autoComplete="street-address" maxLength={200} value={f.address} onChange={(e) => set({ address: e.target.value })} {...inv("address", "vp-address-h")} />
                  <p id="vp-address-h" className="mj-hint">고객에게는 앞 두 마디(예: 서울 도봉구)만 보여요.</p>
                  {err("address")}
                </div>
                <div className={s.grid}>
                  <div className="mj-field">
                    <label className="mj-label" htmlFor="vp-license">실내건축공사업 등록</label>
                    <input id="vp-license" className="mj-input" maxLength={100} placeholder="예: 등록했어요 · 서울 도봉구청" value={f.license} onChange={(e) => set({ license: e.target.value })} {...inv("license", "vp-self-h")} />
                    {err("license")}
                  </div>
                  <div className="mj-field">
                    <label className="mj-label" htmlFor="vp-insurance">보험</label>
                    <input id="vp-insurance" className="mj-input" maxLength={100} placeholder="예: 영업배상책임보험 1억 원" value={f.insurance} onChange={(e) => set({ insurance: e.target.value })} {...inv("insurance", "vp-self-h")} />
                    {err("insurance")}
                  </div>
                </div>
                <p id="vp-self-h" className="mj-hint">믿집이 확인하지 않은 값이라 고객에게 &lsquo;업체가 적음&rsquo;으로 보여요. 비워 두면 &lsquo;확인 안 됨&rsquo;으로 보여요.</p>
              </div>
            </div>
          </section>
        </div>

        {/* 02 하는 공정 */}
        <div className="mj-wrap">
          <section id="trades" className={`mj-sec ${s.sec}`} aria-labelledby="s2-t">
            <div className="mj-sec-l"><p className="mj-code" aria-hidden="true">02</p><h2 id="s2-t" className="mj-h2">하는 공정</h2></div>
            <div className="mj-sec-c">
              <fieldset aria-describedby={desc("trades")}>
                <legend className={s.leg}>공정 <span className={s.opt}>(필수 · 하나 이상)</span></legend>
                <div className={`${s.ckg} ${s.ckg220}`}>
                  {TRADE_KEYS.map((t) => (
                    <label key={t} className={s.ck}>
                      <input id={`vp-t-${t}`} type="checkbox" name="vp-trade" checked={f.trades.includes(t)} onChange={(e) => toggleTrade(t, e.target.checked)} />
                      <span>{tradeLabel(t)}<span className={s.small}>{TRADE_DESC[t]}</span></span>
                    </label>
                  ))}
                </div>
                {err("trades")}
              </fieldset>
              {askTrade ? (
                <Ask key={askTrade} text={`${eulReul(tradeLabel(askTrade))} 빼면 고객 목록에서 빠져요. 넣은 단가는 남아 있어요.`} yes={`${tradeLabel(askTrade)} 빼기`} back={`vp-t-${askTrade}`}
                  onYes={() => { const t = askTrade; setAskTrade(null); set({ trades: f.trades.filter((x) => x !== t) }); setTimeout(() => document.getElementById(`vp-t-${t}`)?.focus(), 0); }}
                  onNo={() => setAskTrade(null)} />
              ) : null}
              {pending ? <p className="mj-small">바꾼 공정은 맨 아래 &lsquo;저장하기&rsquo;를 눌러야 반영돼요.</p> : null}
            </div>
          </section>
        </div>

        {/* 03 가견적에 쓸 견적서 */}
        <div className="mj-wrap">
          <section id="prices" className={`mj-sec ${s.sec}`} aria-labelledby="s3-t">
            <div className="mj-sec-l">
              <p className="mj-code" aria-hidden="true">03</p>
              <h2 id="s3-t" className="mj-h2">가견적에 쓸 견적서</h2>
              <p className="mj-small">예전에 낸 견적서 · 단가표를 근거로 올리고, 항목마다 단가를 직접 넣어요. &lsquo;확인했어요&rsquo;를 누르면 그 단가로 고객 가견적을 계산해요.</p>
            </div>
            <div className="mj-sec-c">
              <PriceSection trades={savedTrades} pending={pending} initial={prices} bizName={saved.biz_name ?? "우리 업체"} exempt={saved.tax_kind === "exempt"} reload={reload} />
            </div>
          </section>
        </div>

        {/* 04 실측 방식 */}
        <div className="mj-wrap">
          <section id="visit" className={`mj-sec ${s.sec}`} aria-labelledby="s4-t">
            <div className="mj-sec-l">
              <p className="mj-code" aria-hidden="true">04</p>
              <h2 id="s4-t" className="mj-h2">실측 방식</h2>
              <p className="mj-small">고객이 실측을 요청하면 이렇게 연락해요. 방문 날짜는 고객과 직접 정해요.</p>
            </div>
            <div className="mj-sec-c" style={{ gap: 24 }}>
              <fieldset aria-describedby={desc("method")}>
                <legend className={s.leg}>연락 방식 <span className={s.opt}>(필수 · 하나)</span></legend>
                <div className={`${s.ckg} ${s.ckg180}`}>
                  {METHODS.map((m) => (
                    <label key={m.key} className={s.ck}><input id={`vp-m-${m.key}`} type="radio" name="vp-method" checked={f.method === m.key} onChange={() => set({ method: m.key })} />{m.label}</label>
                  ))}
                </div>
                {err("method")}
              </fieldset>
              <div className={`mj-field ${s.narrow}`}>
                <label className="mj-label" htmlFor="vp-curl">채널 · 상담 주소 <span className={s.opt}>(카카오톡 채널 · 홈페이지 상담일 때)</span></label>
                <input id="vp-curl" className="mj-input" type="url" inputMode="url" autoComplete="off" placeholder={f.method === "web" ? "예: www.example.com/consult" : "예: pf.kakao.com/_abcd"}
                  value={f.contactUrl} disabled={!urlNeeded} onChange={(e) => set({ contactUrl: e.target.value })} {...inv("contactUrl", "vp-curl-h")} />
                <p id="vp-curl-h" className="mj-hint">전화 · 문자는 위 휴대폰 번호로 연락해요.</p>
                {err("contactUrl")}
              </div>
              <fieldset className={s.narrow} aria-describedby={desc("call", "vp-call-h")}>
                <legend className={s.leg}>통화 가능 시간 <span className={s.opt}>(선택)</span></legend>
                <div className={s.rowEnd}>
                  <div className={`mj-field ${s.time}`}>
                    <label className="mj-label" htmlFor="vp-call-from">시작</label>
                    <select id="vp-call-from" className="mj-select mj-num" value={f.callStart} onChange={(e) => set({ callStart: e.target.value })} aria-invalid={errs.call ? true : undefined}>
                      <option value="">고르지 않음</option>
                      {startOpts.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <span aria-hidden="true" className={s.tilde}>~</span>
                  <div className={`mj-field ${s.time}`}>
                    <label className="mj-label" htmlFor="vp-call-to">끝</label>
                    <select id="vp-call-to" className="mj-select mj-num" value={f.callEnd} onChange={(e) => set({ callEnd: e.target.value })} aria-invalid={errs.call ? true : undefined}>
                      <option value="">고르지 않음</option>
                      {endOpts.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                </div>
                <p id="vp-call-h" className="mj-hint">실측을 요청한 고객에게 보여요.</p>
                {err("call")}
              </fieldset>
              <fieldset aria-describedby={desc("fee", "vp-fee-h")}>
                <legend className={s.leg}>실측 비용 <span className={s.opt}>(필수)</span></legend>
                <div className={s.stack} style={{ gap: 12 }}>
                  <div className={`${s.ckg} ${s.ckg180}`}>
                    <label className={s.ck}><input type="radio" name="vp-fee" checked={f.fee === "free"} onChange={() => set({ fee: "free", refund: false })} />무료</label>
                    <label className={s.ck}><input type="radio" name="vp-fee" checked={f.fee === "paid"} onChange={() => set({ fee: "paid" })} />출장비 받아요</label>
                  </div>
                  <div className={s.rowEnd} style={{ gap: "12px 24px" }}>
                    <div className={`mj-field ${s.fee}`}>
                      <label className="mj-label" htmlFor="vp-fee-won">출장비 (원)</label>
                      <div className={s.unit}>
                        <input id="vp-fee-won" className="mj-input mj-num" inputMode="numeric" autoComplete="off" placeholder="예: 20,000" disabled={f.fee !== "paid"}
                          value={digitsText(f.feeWon)} onChange={(e) => set({ feeWon: digits(e.target.value).slice(0, 7) })} aria-invalid={errs.fee ? true : undefined} aria-describedby="vp-fee-h" />
                        <span aria-hidden="true">원</span>
                      </div>
                    </div>
                  </div>
                  <p id="vp-fee-h" className="mj-hint">출장비는 고객이 낼 금액 그대로(부가세 포함) 적어요. 무료면 비워 둬요.</p>
                </div>
                {err("fee")}
              </fieldset>
              <p className={s.preview}><span className="mj-small">고객에게 보이는 모습</span>{preview ? <b>{preview}</b> : <span className="mj-small">연락 방식과 실측 비용을 고르면 보여요.</span>}</p>

              <div className={s.block}>
                <fieldset aria-describedby={desc("tax", "vp-tax-h")}>
                  <legend className={`${s.h3} ${s.legH}`}>부가세 <span className={s.opt}>(필수)</span></legend>
                  <div className={`${s.ckg} ${s.ckg220}`}>
                    <label className={s.ck}><input type="radio" name="vp-tax" checked={f.tax === "general"} onChange={() => set({ tax: "general" })} />부가세 따로 받아요</label>
                    <label className={s.ck}><input type="radio" name="vp-tax" checked={f.tax === "exempt"} onChange={() => set({ tax: "exempt" })} />면세(간이과세 등)</label>
                  </div>
                </fieldset>
                <p id="vp-tax-h" className="mj-hint">면세를 고르면 고객 가견적에 부가세를 더하지 않아요.</p>
                {err("tax")}
              </div>

              <div className={s.block}>
                <h3 className={s.h3}>자주 묻는 5가지 <span className={s.opt}>(선택)</span></h3>
                <p className="mj-hint">고객이 업체 자세히에서 봐요. 비워 둔 질문은 안 보여요. 질문마다 200자까지예요.</p>
                {FAQS.map((q) => (
                  <div key={q.key} className="mj-field">
                    <label className="mj-label" htmlFor={`vp-faq_${q.key}`}>{q.label}</label>
                    <textarea id={`vp-faq_${q.key}`} className={`mj-textarea ${s.textarea}`} maxLength={200} placeholder={q.ph} value={f.faqs[q.key]}
                      onChange={(e) => set({ faqs: { ...f.faqs, [q.key]: e.target.value } })} {...inv(`faq_${q.key}`)} />
                    {err(`faq_${q.key}`)}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* 05 시공 사진 · 링크 */}
        <div className="mj-wrap">
          <section id="photos" className={`mj-sec ${s.sec}`} aria-labelledby="s5-t">
            <div className="mj-sec-l"><p className="mj-code" aria-hidden="true">05</p><h2 id="s5-t" className="mj-h2">시공 사진 · 링크</h2></div>
            <div className="mj-sec-c" style={{ gap: 24 }}>
              {f.photos.length ? (
                <ul className={s.photos} aria-label={`올린 시공 사진 ${f.photos.length}장`}>
                  {f.photos.map((p, i) => (
                    <li key={p.id}>
                      <img className={s.pic} src={`/api/files/${p.file_id}`} alt={`시공 사진 ${i + 1}: ${p.title}`} loading="lazy" />
                      <div className="mj-field">
                        <label className="mj-label" htmlFor={`vp-ph-${i}`}>사진 {i + 1} 설명</label>
                        <input id={`vp-ph-${i}`} className="mj-input" maxLength={60} value={p.title} onChange={(e) => setPhoto(p.id, e.target.value)} {...inv(`photo${i}`, "vp-ph-h")} />
                        {err(`photo${i}`)}
                      </div>
                      <button id={`vp-ph-x-${p.id}`} type="button" className="mj-lnk" style={{ alignSelf: "flex-start", minWidth: 44, justifyContent: "center" }}
                        aria-label={`사진 ${i + 1} ${p.title} 빼기`} aria-expanded={askPhoto === p.id} disabled={!!photoBusy} onClick={() => setAskPhoto(p.id)}>빼기</button>
                      {askPhoto === p.id ? (
                        <Ask text="사진을 빼면 고객 화면에서도 사라져요." yes="사진 빼기" busy={photoBusy === "x"} back={`vp-ph-x-${p.id}`} onYes={() => removePhoto(p)} onNo={() => setAskPhoto(null)} />
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : <p className="mj-sub">아직 올린 시공 사진이 없어요.</p>}
              <div className={s.row}>
                <button id="vp-ph-up" type="button" className="mj-btn mj-btn-sec" aria-describedby="vp-ph-h" disabled={!!photoBusy || f.photos.length >= PHOTO_MAX} onClick={() => photoIn.current?.click()}><Up />사진 올리기</button>
                <input ref={photoIn} type="file" multiple hidden accept={WORK_PHOTO.accept} onChange={(e) => addPhotos(e.target.files)} />
                <p id="vp-ph-h" className="mj-hint">JPG · PNG · WebP · 한 장 {WORK_PHOTO.mb}MB · {PHOTO_MAX}장까지 · 사진 설명은 60자까지</p>
              </div>
              <p className="mj-small" role="status">{photoMsg}</p>
              {photoBad.length ? (
                <ul className={s.bad} aria-label="올리지 못한 사진">
                  {photoBad.map((b, i) => <li key={i}><b>{b.name}</b> · <span className="mj-error">{b.msg}</span></li>)}
                </ul>
              ) : null}

              <fieldset className={s.narrow}>
                <legend className={s.leg}>시공 사례 링크 <span className={s.opt}>(선택 · {LINKS_MAX}개까지)</span></legend>
                <div className={s.stack} style={{ gap: 8 }}>
                  {f.links.map((l, i) => (
                    <div key={l.key} className="mj-field" style={{ gap: 4 }}>
                      <div className={s.linkRow}>
                        <label htmlFor={`vp-link-${i}`} className="mj-sr">시공 사례 링크 {i + 1}</label>
                        <input id={`vp-link-${i}`} className="mj-input" type="url" inputMode="url" autoComplete="off" placeholder="예: blog.example.com/2610" value={l.url}
                          onChange={(e) => set({ links: f.links.map((x) => (x.key === l.key ? { ...x, url: e.target.value } : x)) })} {...inv(`link${i}`)} />
                        <button type="button" className="mj-btn mj-btn-sec" style={{ flex: "none" }} aria-label={`시공 사례 링크 ${i + 1} 빼기`}
                          onClick={() => { set({ links: f.links.filter((x) => x.key !== l.key) }); setTimeout(() => document.getElementById("vp-link-add")?.focus(), 0); }}>빼기</button>
                      </div>
                      {err(`link${i}`)}
                    </div>
                  ))}
                  <button id="vp-link-add" type="button" className="mj-btn mj-btn-sec" style={{ alignSelf: "flex-start" }} onClick={addLink} disabled={f.links.length >= LINKS_MAX}>링크 더하기</button>
                </div>
              </fieldset>
              <div className={`mj-field ${s.narrow}`}>
                <label className="mj-label" htmlFor="vp-site">홈페이지 주소 <span className={s.opt}>(선택)</span></label>
                <input id="vp-site" className="mj-input" type="url" inputMode="url" autoComplete="url" placeholder="예: www.example.com" value={f.site} onChange={(e) => set({ site: e.target.value })} {...inv("site")} />
                {err("site")}
              </div>
            </div>
          </section>
        </div>

        {/* 저장 줄: 오류는 저장하기 버튼 바로 위 */}
        <div className="mj-wrap">
          <div className={s.bar}>
            {errs.form ? (
              <div className={s.barErr}>
                <div id="vp-form-err" tabIndex={-1}><FieldError id="vp-e-form">{errs.form}</FieldError></div>
                {stale ? <button type="button" className="mj-btn mj-btn-sec mj-btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => window.location.reload()}>다시 열기</button> : null}
              </div>
            ) : Object.keys(errs).length ? <p className={`mj-error ${s.barErr}`}>고칠 칸이 {Object.keys(errs).length}곳 있어요. 칸 아래 안내를 봐 주세요.</p> : null}
            <p className="mj-small">마지막 저장 <span className="mj-num">{lastSaved}</span></p>
            <div className={s.barRight}>
              <p className={done ? "mj-st mj-st-ok" : "mj-small"} role="status">{done ? <><Check />{done}</> : null}</p>
              <button id="vp-save" type="submit" className={`mj-btn mj-btn-pri ${s.save}`} disabled={busy}>{busy ? "저장하는 중이에요" : "저장하기"}</button>
            </div>
          </div>
        </div>
      </form>
    </main>
  );
}
