"use client";
// 업체 자세히 창(2026-11-26 사용자): 재재 보드에서 업체 이름을 누르면 화면을 옮기지 않고 재재 화면 위 큰 창으로 봐요(표준견적서 창과 같은 틀).
// 읽기: GET /projects/{id}/vendors/{vid}?trade=(가견적 · 별점 · 시공 사례는 서버 값 그대로, 화면은 더하지 않아요). 남의 공사 · 목록 밖 업체면 404 글.
// 사진 주소는 lib/api/shortlist.photoSrc와 같아요(그 파일은 서버 전용이라 창에서 import하지 않아요).
// 담기 · 빼기는 보드와 같은 act(결과 한 줄이 대화에 붙어요). 리뷰 전체 · 견적 줄은 '전체 화면으로 보기'.
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useModal } from "@/components/ui/useModal";
import { areasText, caseLabel, compareText, feeText } from "@/components/vendors/v3text";
import { call, errorText, type Schemas } from "@/lib/backend/client";
import { won } from "@/lib/format";
import { pickRule, type PickState } from "./boardLink";
import d from "./StandardDialog.module.css";
import s from "./flow.module.css";

type Detail = Schemas["VendorDetailOut"];
type Act = (key: string, fn: () => Promise<unknown>, said?: string) => Promise<void>;
export type VendorOpen = { vendorId: string; trade: "dobae" | "mokgong" } | null;
const TRADE_WORD = { dobae: "도배", mokgong: "목공" } as const;

export function VendorDialog({ pid, open, onClose, busy, act, pick }: { pid: string; open: VendorOpen; onClose: () => void; busy: string | null; act: Act; pick: PickState }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const h = useModal(ref, !!open, onClose);
  const [v, setV] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  /** 담기 · 빼기 결과(대화 줄은 창 뒤라 안 보여요) */
  const [said, setSaid] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    let live = true;
    setV(null);
    setErr(null);
    setSaid(null);
    call<Detail>("GET", `/projects/${pid}/vendors/${encodeURIComponent(open.vendorId)}?trade=${open.trade}`)
      .then((x) => { if (live) setV(x); })
      .catch((e) => { if (live) setErr(errorText(e)); });
    return () => { live = false; };
  }, [open, pid]);

  const name = v?.profile.biz_name ?? "업체";
  const t = open?.trade ?? "dobae";
  const picked = !!v?.shortlisted;
  // 보드 줄과 같은 규칙(#220 리뷰): 확정 · 실측 요청 · 남은 칸에 따라 담기 · 빼기를 막아요
  const can = open ? pickRule({ vendor_id: open.vendorId, shortlisted: picked }, pick) : { add: false, remove: false };
  const shut = open && pick.live.has(open.vendorId) ? "실측 요청한 업체예요" : pick.locked ? `${TRADE_WORD[t]} 업체를 확정했어요` : !picked && !can.add ? "3곳을 다 담았어요" : null;
  // 도배는 v3 가견적(보드 · 목록과 같은 값). 서버가 v3를 도배만 세서 목공은 목록과 같은 기존 가견적(estimate)을 써요
  const est = v?.estimate_v3 ?? v?.estimate ?? null;
  const pct = v?.estimate_v3?.vs_standard_pct ?? null;
  return (
    <dialog ref={ref} className={d.dlg} aria-labelledby={`${id}-t`} onCancel={h.onCancel} onClick={h.onClick}>
      {open ? (
        <div className={d.card}>
          <div className={d.head}>
            <h2 id={`${id}-t`}>업체 자세히{v ? ` · ${name}` : ""}</h2>
            <button type="button" className={d.x} aria-label="닫기" onClick={onClose}><Icon name="close" /></button>
          </div>
          <div className={d.body}>
            {err ? <p className="mj-error" role="alert">{err}</p> : null}
            {!v && !err ? <p className={s.note}>업체 정보를 불러오는 중이에요</p> : null}
            {v ? (
              <>
                <section className={s.card}>
                  <div className={s.vdTop}>
                    <div>
                      <h3 className={s.vdName}>{name}</h3>
                      <p className={s.note}>{[v.instant_badge ? "바로 확정" : "", v.verified_on ? "사업자 확인함" : "", v.years_open != null ? `${v.years_open}년째` : ""].filter(Boolean).join(" · ")}</p>
                    </div>
                    <div className={s.vdPrice}>
                      <span className={s.note}>{TRADE_WORD[t]} 가견적 · 부가세 포함</span>
                      <b className="mj-num">{est ? won(est.total) : "준비 중"}</b>
                      {pct != null ? <span className={s.note}>{compareText(pct) ?? ""}</span> : null}
                    </div>
                  </div>
                  <dl className={s.vdRows}>
                    <div><dt>별점</dt><dd>{v.rating?.avg ? `${v.rating.avg} · 리뷰 ${v.rating.count}` : "리뷰가 아직 없어요"}</dd></div>
                    <div><dt>믿집 시공</dt><dd>{v.rating?.done_count ?? 0}건</dd></div>
                    <div><dt>답 평균</dt><dd>{v.reply_hours != null ? `${v.reply_hours}시간 안` : "—"}</dd></div>
                    <div><dt>시공 지역</dt><dd>{areasText(v.profile.areas.map((a) => a.label)) || "—"}</dd></div>
                    <div><dt>실측</dt><dd>{feeText(v.profile.visit_fee) ?? "—"}</dd></div>
                  </dl>
                  {v.not_included.length ? <p className={s.why}>가견적에 없는 것: {v.not_included.join(" · ")}. 실측 때 물어보세요.</p> : null}
                </section>
                {v.profile.portfolio.length ? (
                  <section className={s.card}>
                    <h4>시공 사례</h4>
                    <ul className={s.pics} aria-label="시공 사례 사진">
                      {v.profile.portfolio.slice(0, 6).map((x) => (
                        <li key={x.id}><img src={`/api/projects/${pid}/vendors/${encodeURIComponent(v.profile.vendor_id)}/photos/${encodeURIComponent(x.file_id)}`} alt={caseLabel(x)} loading="lazy" /></li>
                      ))}
                    </ul>
                  </section>
                ) : null}
              </>
            ) : null}
          </div>
          <div className={d.actions}>
            {said ? <p className={s.note} role="status">{said}</p> : null}
            <Button size="lg" variant="secondary" href={`/projects/${pid}/vendors/${encodeURIComponent(open.vendorId)}`}>리뷰 · 견적 줄 전체 보기</Button>
            {v && v.state === "ok" ? (
              <Button size="lg" variant={picked ? "secondary" : "primary"} disabled={!(can.add || can.remove)} busy={busy === open.vendorId}
                onClick={() => (can.add || can.remove) && act(open.vendorId, async () => {
                  await (picked ? call("DELETE", `/projects/${pid}/shortlist/${encodeURIComponent(open.vendorId)}?trade=${t}`) : call("POST", `/projects/${pid}/shortlist`, { trade: t, vendor_id: open.vendorId }));
                  setV((x) => (x ? { ...x, shortlisted: !picked } : x));
                  setSaid(picked ? "뺐어요." : "담았어요. 창을 닫고 실측 칸에서 날짜를 골라요.");
                }, `${TRADE_WORD[t]} ${name}${picked ? " 뺐어요" : " 담았어요"}`)}>
                {shut ?? (picked ? "빼기" : "담기")}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
