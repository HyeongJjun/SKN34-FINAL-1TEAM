"use client";
// '실측 요청 보내기' 확인 창 (시안 WVendors 메모 · WVendorDetail 메모). 업체 고르기(여러 곳)와 업체 자세히(한 곳)가 같이 쓴다.
// 내 연락처는 체크한 업체에만 간다. 체크하면 아파트 이름 · 동 · 호수 칸이 열리고, 휴대폰이 없으면 번호 넣기로 보낸다.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FieldError, Req } from "@/components/auth/parts";
import { withNext } from "@/components/auth/next";
import { ApiError, call, errorText, type Schemas } from "@/lib/backend/client";
import { phoneText, tradeLabel } from "@/lib/labels";
import { Close, Warn } from "./icons";
import { iGa, type Created, type VTrade } from "./text";
import s from "./dialog.module.css";

type Me = Schemas["MeOut"];
type Target = { id: string; name: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onSent: (r: Created) => void;
  projectId: string;
  trade: VTrade;
  vendors: Target[];
  message?: string;
  consentVer: string;
  /** 휴대폰 번호를 넣고 돌아올 곳 (이 화면) */
  backTo: string;
  /** 같은 화면에 창이 둘일 때 칸 id 앞머리 */
  idp: string;
};

// 그사이 바뀐 것: 다시 읽으면 화면이 맞춰진다(already_chosen은 확정 안내로 바뀐다)
const NEEDS_REFRESH = new Set(["consent_changed", "slots_full", "already", "unavailable", "stale", "already_chosen"]);

export function RequestDialog({ open, onClose, onSent, projectId, trade, vendors, message, consentVer, backTo, idp }: Props) {
  const router = useRouter();
  const dlg = useRef<HTMLDialogElement>(null);
  const aptRef = useRef<HTMLInputElement>(null);
  const [share, setShare] = useState<string[]>([]);
  const [apt, setApt] = useState("");
  const [dong, setDong] = useState("");
  const [ho, setHo] = useState("");
  const [me, setMe] = useState<Me | null>(null);
  const [noPhone, setNoPhone] = useState(false);
  const [addrErr, setAddrErr] = useState("");
  const [formErr, setFormErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (open && !d.open) {
      setShare([]);
      setNoPhone(false);
      setAddrErr("");
      setFormErr("");
      d.showModal();
      // 휴대폰 번호 · 이름 (내 연락처 보내기 안내에 쓴다)
      call<Me>("GET", "/me").then(setMe, () => setMe(null));
    } else if (!open && d.open) d.close();
  }, [open]);

  const one = vendors.length === 1 ? vendors[0] : null;
  const names = vendors.map((v) => v.name).join(" · ");
  const sharing = share.length > 0;
  const phoneMissing = noPhone || (sharing && me !== null && !me.phone);
  const p = (k: string) => `${idp}-${k}`;

  function toggle(id: string, on: boolean) {
    setShare((cur) => (on ? [...cur.filter((x) => x !== id), id] : cur.filter((x) => x !== id)));
    setFormErr("");
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setFormErr("");
    setAddrErr("");
    if (sharing && phoneMissing) { setNoPhone(true); return; }
    if (sharing && !(apt.trim() && dong.trim() && ho.trim())) {
      setAddrErr("아파트 이름 · 동 · 호수를 적어 주세요.");
      aptRef.current?.focus();
      return;
    }
    setBusy(true);
    try {
      const r = await call<Created>("POST", `/projects/${projectId}/visits`, {
        trade,
        vendor_ids: vendors.map((v) => v.id),
        message: message?.trim() || null,
        share_contact_ids: share,
        apt_name: sharing ? apt.trim() : null,
        dong: sharing ? dong.trim() : null,
        ho: sharing ? ho.trim() : null,
        consent_ver: sharing ? consentVer : null,
      });
      setBusy(false);
      onSent(r);
      return;
    } catch (er) {
      const code = er instanceof ApiError ? er.code : "";
      if (code === "phone_required") setNoPhone(true);
      else if (code === "address_required") { setAddrErr(errorText(er)); aptRef.current?.focus(); }
      else setFormErr(errorText(er));
      if (NEEDS_REFRESH.has(code)) router.refresh();
    }
    setBusy(false);
  }

  return (
    <dialog ref={dlg} className={s.dlg} aria-labelledby={p("t")} onClose={onClose}>
      <form className={s.form} onSubmit={send} noValidate>
        <button type="button" className={s.x} aria-label="닫기" onClick={() => dlg.current?.close()}><Close /></button>
        <h2 id={p("t")} className="mj-h3">{names}에 {tradeLabel(trade)} 실측을 요청할까요?</h2>
        <p>{one ? `요청하면 ${one.name} 연락처가 보여요. 연락해 방문 날짜를 정해 주세요.` : "요청하면 업체 연락처가 보여요. 업체에 연락해 방문 날짜를 정해 주세요."}</p>

        {one ? (
          <div className={s.cs}>
            <label className={s.ck}>
              <input type="checkbox" checked={sharing} onChange={(e) => toggle(one.id, e.target.checked)} aria-describedby={p("n")} />
              <span>{iGa(one.name)} 먼저 연락하게 내 연락처 보내기 <span className="mj-opt">(선택)</span></span>
            </label>
            <p id={p("n")} className={`mj-small ${s.note}`}>이름 · 휴대폰 · 주소가 {one.name}에만 가요. 실측 · 공사 연락에만 쓰고, 요청이 닫히면 지워요(확정하면 공사 끝나고 1년). 안 보내도 요청돼요.</p>
          </div>
        ) : (
          <fieldset className={s.cs}>
            <legend>업체가 먼저 연락하게 내 연락처 보내기 <span className="mj-opt">(선택)</span></legend>
            {vendors.map((v) => (
              <label key={v.id} className={s.ck}>
                <input type="checkbox" checked={share.includes(v.id)} onChange={(e) => toggle(v.id, e.target.checked)} aria-describedby={p("n")} />
                <span>{v.name}</span>
              </label>
            ))}
            <p id={p("n")} className={`mj-small ${s.note}`}>이름 · 휴대폰 · 주소가 체크한 업체에만 가요. 실측 · 공사 연락에만 쓰고, 요청이 닫히면 지워요(확정하면 공사 끝나고 1년). 안 보내도 요청돼요.</p>
          </fieldset>
        )}

        {sharing && phoneMissing ? (
          <div className={s.noPhone}>
            <p className={`mj-error ${s.err}`} role="alert"><Warn />업체에 보내려면 휴대폰 번호가 필요해요.</p>
            <Link className={`mj-lnk ${s.self}`} href={withNext("/signup/phone", backTo)}>휴대폰 번호 넣기</Link>
            <p className="mj-small">체크를 풀면 번호 없이도 요청할 수 있어요. 번호를 넣으면 담은 업체 그대로 이 화면으로 돌아와요.</p>
          </div>
        ) : sharing ? (
          <fieldset className={s.addr} aria-describedby={`${p("ah")}${addrErr ? ` ${p("ae")}` : ""}`}>
            <legend>아파트 이름 · 동 · 호수 <Req /></legend>
            <div className={s.addrRow}>
              <div className={s.cell}>
                <label className={s.lab} htmlFor={p("apt")}>아파트 이름</label>
                <input ref={aptRef} id={p("apt")} className="mj-input" value={apt} maxLength={40} autoComplete="address-line1" placeholder="예: 상계주공" aria-invalid={!!addrErr && !apt.trim()} onChange={(e) => { setApt(e.target.value); setAddrErr(""); }} />
              </div>
              <div className={s.cell}>
                <label className={s.lab} htmlFor={p("dong")}>동</label>
                <input id={p("dong")} className="mj-input mj-num" value={dong} maxLength={10} inputMode="numeric" placeholder="104" aria-invalid={!!addrErr && !dong.trim()} onChange={(e) => { setDong(e.target.value); setAddrErr(""); }} />
              </div>
              <div className={s.cell}>
                <label className={s.lab} htmlFor={p("ho")}>호수</label>
                <input id={p("ho")} className="mj-input mj-num" value={ho} maxLength={10} inputMode="numeric" placeholder="1203" aria-invalid={!!addrErr && !ho.trim()} onChange={(e) => { setHo(e.target.value); setAddrErr(""); }} />
              </div>
            </div>
            {addrErr ? <FieldError id={p("ae")}>{addrErr}</FieldError> : null}
            <p id={p("ah")} className="mj-hint mj-num">{me ? `${me.name} · ${phoneText(me.phone)}도 함께 가요.` : "이름 · 휴대폰도 함께 가요."}</p>
          </fieldset>
        ) : null}

        {formErr ? <FieldError id={p("fe")} alert>{formErr}</FieldError> : null}
        <div className={s.btns}>
          <button type="submit" className="mj-btn mj-btn-pri" disabled={busy}>{busy ? "보내고 있어요…" : "요청 보내기"}</button>
          <button type="button" className="mj-btn mj-btn-sec" onClick={() => dlg.current?.close()}>돌아가기</button>
        </div>
      </form>
    </dialog>
  );
}
