"use client";
// 업체 자세히 창(2026-11-26 사용자): 재재 보드에서 업체 이름을 누르면 화면을 옮기지 않고 재재 화면 위 큰 창으로 봐요(표준견적서 창과 같은 틀).
// 읽기: GET /projects/{id}/vendors/{vid}?trade=(가견적 · 별점 · 시공 사례는 서버 값 그대로, 화면은 더하지 않아요). 남의 공사 · 목록 밖 업체면 404 글.
// 사진 주소는 lib/api/shortlist.photoSrc와 같아요(그 파일은 서버 전용이라 창에서 import하지 않아요).
// 담기 · 빼기는 보드와 같은 act(결과 한 줄이 대화에 붙어요). 가견적 줄 · 최근 리뷰도 창 안에서 봐요(옮기지 않아요).
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Lightbox } from "@/components/ui/Lightbox";
import { Segmented } from "@/components/ui/Segmented";
import { useModal } from "@/components/ui/useModal";
import { areasText, caseLabel, compareText, feeText } from "@/components/vendors/v3text";
import { call, errorText, type Schemas } from "@/lib/backend/client";
import { won, wonDelta, wonFull } from "@/lib/format";
import { pickRule, type PickState } from "./boardLink";
import d from "./StandardDialog.module.css";
import s from "./flow.module.css";

type Detail = Schemas["VendorDetailOut"];
type Reviews = Schemas["ReviewPageOut"];
type Act = (key: string, fn: () => Promise<unknown>, said?: string) => Promise<void>;
/** grade: 벽지(도배만, ?grade=) · photo: 처음 크게 볼 시공 사례(1부터, ?photo=). 옛 업체 화면 주소에서 넘어와요(#237 리뷰) */
export type VendorOpen = { vendorId: string; trade: "dobae" | "mokgong"; grade?: "basic" | "economy" | null; photo?: number | null } | null;
const TRADE_WORD = { dobae: "도배", mokgong: "목공" } as const;

export function VendorDialog({ pid, open, onClose, busy, act, pick }: { pid: string; open: VendorOpen; onClose: () => void; busy: string | null; act: Act; pick: PickState }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const h = useModal(ref, !!open, onClose);
  const [v, setV] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  /** 담기 · 빼기 결과(대화 줄은 창 뒤라 안 보여요) */
  const [said, setSaid] = useState<string | null>(null);
  const [rv, setRv] = useState<Reviews | null>(null);
  /** 고른 벽지(도배만). 바꾸면 그 벽지 가견적을 서버에서 다시 받아요(화면은 금액을 더하거나 빼지 않아요) */
  const [grade, setGrade] = useState<"basic" | "economy" | null>(null);
  /** 크게 보는 시공 사례(0부터) */
  const [at, setAt] = useState<number | null>(null);
  // 사진을 크게 본 채 Esc를 누르면 Chrome이 이 창에도 cancel을 보내 같이 닫아요. 그때는 이 창을 다시 열어 사진만 닫히게 해요
  const keep = useRef(false);
  /** 사진 창이 닫힌 때(같은 Esc로 이 창 cancel이 바로 뒤에 와요) */
  const photoShut = useRef(0);
  useEffect(() => { setGrade(open?.grade ?? null); setAt(null); }, [open]);
  useEffect(() => {
    if (!open) return;
    let live = true;
    setErr(null);
    const g = open.trade === "dobae" && grade ? `&grade=${grade}` : "";
    call<Detail>("GET", `/projects/${pid}/vendors/${encodeURIComponent(open.vendorId)}?trade=${open.trade}${g}`)
      .then((x) => { if (live) setV(x); })
      .catch((e) => { if (live) setErr(errorText(e)); });
    return () => { live = false; };
  }, [open, pid, grade]);
  // 주소로 고른 사진(?photo=n)은 사진을 읽은 뒤 한 번 크게 열어요
  const photoAsked = open?.photo ?? null;
  const photoCount = v?.profile.portfolio.length ?? 0;
  useEffect(() => { if (photoAsked && photoAsked <= photoCount) setAt(photoAsked - 1); }, [photoAsked, photoCount]);
  useEffect(() => {
    if (!open) return;
    let live = true;
    setV(null);
    setSaid(null);
    setRv(null);
    // 최근 리뷰(숨긴 리뷰 빠짐). 못 읽어도 창은 그대로
    call<Reviews>("GET", `/projects/${pid}/vendors/${encodeURIComponent(open.vendorId)}/reviews?sort=latest`).then((x) => { if (live) setRv(x); }).catch(() => {});
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
  const photoUrl = (fileId: string) => `/api/projects/${pid}/vendors/${encodeURIComponent(v?.profile.vendor_id ?? "")}/photos/${encodeURIComponent(fileId)}`;
  return (
    <dialog ref={ref} className={d.dlg} aria-labelledby={`${id}-t`} onCancel={(e) => { if (at !== null || performance.now() - photoShut.current < 300) { keep.current = true; e.preventDefault(); return; } h.onCancel(e); }} onClose={() => { if (!keep.current) return; keep.current = false; if (open && ref.current && !ref.current.open) ref.current.showModal(); }} onClick={h.onClick}>
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
                      {pct != null ? <span className={s.note}>{compareText(pct) ?? ""} · 기준 {TRADE_WORD[t]} 시장 단가 {won(v.standard_total)}</span> : null}
                    </div>
                  </div>
                  <dl className={s.vdRows}>
                    <div><dt>별점</dt><dd>{v.rating?.avg ? `${v.rating.avg} · 리뷰 ${v.rating.count}` : "리뷰가 아직 없어요"}</dd></div>
                    <div><dt>믿집 시공</dt><dd>{v.rating?.done_count ?? 0}건</dd></div>
                    <div><dt>답 평균</dt><dd>{v.reply_hours != null ? `${v.reply_hours}시간 안` : "—"}</dd></div>
                    <div><dt>시공 지역</dt><dd>{areasText(v.profile.areas.map((a) => a.label)) || "—"}</dd></div>
                    <div><dt>실측</dt><dd>{feeText(v.profile.visit_fee) ?? "—"}</dd></div>
                  </dl>
                  {t === "dobae" && est ? (
                    <Segmented legend="벽지" hideLegend value={v.grade ?? grade ?? "basic"} onChange={(x) => setGrade(x === "economy" ? "economy" : "basic")} options={[
                      { value: "basic", label: "실크", sub: (v.grade ?? "basic") !== "basic" && v.grade_diff != null ? wonDelta(v.grade_diff) : undefined },
                      { value: "economy", label: "합지", sub: v.grade !== "economy" && v.grade_diff != null ? wonDelta(v.grade_diff) : undefined },
                    ]} />
                  ) : null}
                  {v.not_included.length ? <p className={s.why}>가견적에 없는 것: {v.not_included.join(" · ")}. 실측 때 물어보세요.</p> : null}
                </section>
                {est?.lines.length ? (
                  <details className={s.card}>
                    <summary className={s.site}>가견적 줄 보기 · 업체 단가 × 믿집 수량</summary>
                    <ul className={s.vlines}>
                      {est.lines.filter((x) => x.amount).map((x) => <li key={x.key}><span>{x.name} <span className={s.note}>{x.qty}{x.unit}</span></span><b className="mj-num">{wonFull(x.amount)}</b></li>)}
                    </ul>
                  </details>
                ) : null}
                {rv?.items.length ? (
                  <section className={s.card}>
                    <h4>최근 리뷰</h4>
                    {rv.items.slice(0, 4).map((x) => (
                      <div key={x.id} className={s.rv}>
                        <span><b>별 {x.rating}</b> <span className={s.note}>{x.author_label}{x.context_label ? ` · ${x.context_label}` : ""}</span></span>
                        {x.body ? <span>{x.body}</span> : null}
                      </div>
                    ))}
                  </section>
                ) : null}
                {v.profile.portfolio.length ? (
                  <section className={s.card}>
                    <h4>시공 사례</h4>
                    <ul className={s.pics} aria-label="시공 사례 사진">
                      {v.profile.portfolio.slice(0, 6).map((x, i) => (
                        <li key={x.id}><button type="button" className={s.pic} onClick={() => setAt(i)} aria-label={`${caseLabel(x)} 크게 보기`}><img src={photoUrl(x.file_id)} alt="" loading="lazy" /></button></li>
                      ))}
                    </ul>
                    <Lightbox open={at !== null} start={at ?? 0} onClose={() => { photoShut.current = performance.now(); setAt(null); }} label="시공 사례"
                      photos={v.profile.portfolio.map((x) => ({ key: x.id, src: photoUrl(x.file_id), alt: `${caseLabel(x)} 시공 사진`, title: caseLabel(x) }))} />
                  </section>
                ) : null}
              </>
            ) : null}
          </div>
          <div className={d.actions}>
            {said ? <p className={s.note} role="status">{said}</p> : null}
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
