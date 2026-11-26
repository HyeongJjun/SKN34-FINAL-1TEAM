"use client";
// 도배 · 목공(문 포함) 표준견적서: 업체 견적서 235건 시장 단가로 계산한다. 평형(또는 면적)만 넣어도 바로 나오고,
// 목공 선택 항목을 켜고 끄면 총액이 얼마 바뀌는지 보여 준다.
// 화면 틀은 내 공사 표준견적서(/projects/{id}/standard)와 같다: 큰 합계 → 줄 표(공급가 + 부가세) · 옆 AI 칸.
// 숫자는 모두 POST /v2/market-quote(계산 엔진) 응답을 보이기만 한다. 공급가 · 부가세를 나눠 보이는 곳은 합계 표 하나다.
import { useEffect, useRef, useState } from "react";
import { GuestAsk } from "@/components/ai/GuestAsk";
import { JoinDialog } from "@/components/auth/JoinDialog";
import { Main, PageHead, WithAside } from "@/components/site/Frame";
import { GUEST_ASK_EVENT, GuestAskSheet } from "@/components/start/GuestAside";
import { StandardSkeleton } from "@/components/start/StandardSheet";
import { BottomBar } from "@/components/ui/BottomBar";
import { Button } from "@/components/ui/Button";
import { Check } from "@/components/ui/Check";
import { Field, SelectField } from "@/components/ui/Field";
import { BigFigure } from "@/components/ui/Money";
import { QuoteLines } from "@/components/ui/QuoteLines";
import { Segmented } from "@/components/ui/Segmented";
import type { components } from "@/lib/backend/schema";
import { errorText } from "@/lib/backend/client";
import { numText, won, wonFull } from "@/lib/format";
import { sumLines, tradeLines } from "@/lib/guest/market";
import { v2Post } from "../api";
import s from "./MarketQuote.module.css";

type Out = components["schemas"]["V2MqOut"];
type In = components["schemas"]["V2MqIn"];
type Opt = Out["options"][number];
type OptKey = Opt["key"];

const WALLPAPER = [
  { value: "silk", label: "실크 벽지", sub: "닦을 수 있어요" },
  { value: "hapji", label: "합지 벽지", sub: "저렴해요" },
];
const DOOR = [
  { value: "abs", label: "ABS 도어", sub: "매끈한 기본 문" },
  { value: "emboss", label: "ABS 엠보스", sub: "결이 있는 표면" },
];
const JUNGMUN = [
  { value: "slim3", label: "초슬림 3연동", sub: "세 짝이 같이" },
  { value: "slide", label: "원슬라이딩", sub: "한 짝이 크게" },
  { value: "swing", label: "양방향 스윙", sub: "여닫이" },
];
const GLOSSARY: [string, string][] = [
  ["순공사비", "자재 + 인건비 + 경비. 실제 공사에 드는 돈"],
  ["회사이윤", "업체가 남기는 몫 (양식 요율 5%)"],
  ["공과잡비", "소모품 · 공구 · 현장 정리 같은 자잘한 비용 (2%)"],
  ["산재 · 고용보험료", "작업자 보험료 (1.1% · 0.42%)"],
  ["품", "기능공 1명이 하루에 하는 일"],
  ["단수 정리", "끝자리를 맞추려고 버린 금액 (만 원 아래)"],
  ["걸레받이 / 몰딩", "바닥 · 벽 / 천장 · 벽 사이 테두리"],
  ["문선", "문틀 둘레를 감싸는 마감재"],
];

type Form = {
  mode: "py" | "m2";
  py: string;
  m2: string;
  basis: "exclusive" | "supply";
  rooms: string;
  baths: string;
  dobae: boolean;
  mokgong: boolean;
  wallpaper: In["wallpaper"];
  door: In["door"];
  jungmun: In["jungmun"];
  options: OptKey[] | null; // null = 235건에서 흔한 것
};
const START: Form = { mode: "py", py: "32", m2: "84", basis: "exclusive", rooms: "", baths: "", dobae: true, mokgong: true, wallpaper: "silk", door: "abs", jungmun: "slim3", options: null };

function body(f: Form): In | null {
  const n = (v: string) => (v.trim() === "" ? null : Number(v));
  const size = f.mode === "py" ? n(f.py) : n(f.m2);
  if (size == null || !(size > 0) || !(f.dobae || f.mokgong)) return null;
  return {
    ...(f.mode === "py" ? { pyeong: size } : { area_m2: size, area_basis: f.basis }),
    rooms: n(f.rooms),
    baths: n(f.baths),
    dobae: f.dobae,
    mokgong: f.mokgong,
    wallpaper: f.wallpaper,
    door: f.door,
    jungmun: f.jungmun,
    options: f.options,
  } as In;
}

/** 큰 합계 카드(+ 조건 바꾸기). 내 공사 표준견적서와 같은 모양 */
export function MarketTotal({ q, changeHref, caption, onChange }: { q: Out; changeHref: string; caption?: string; /** 재재 화면 창: 옮기지 않고 그 자리에서 고치기 */ onChange?: () => void }) {
  return (
    <section className={s.group} aria-label="표준견적서 합계">
      <div className={s.totalRow}>
        <BigFigure
          value={q.total}
          caption={caption ?? `부가세 포함 · 평당 약 ${won(q.per_pyeong)}`}
          sub={`${numText(q.pyeong)}평형 · 방 ${q.rooms} · 욕실 ${q.baths}${q.rooms_auto ? " (어림)" : ""} · ${q.trades.map((t) => `${t.name} ${won(t.total)}`).join(" + ")}`}
        />
        {onChange ? <Button variant="text" onClick={onChange}>조건 바꾸기</Button> : <Button variant="text" href={changeHref}>조건 바꾸기</Button>}
      </div>
    </section>
  );
}

export function MarketQuote() {
  const [f, setF] = useState<Form>(START);
  const [q, setQ] = useState<Out | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [join, setJoin] = useState(false);
  const [ask, setAsk] = useState(false);
  const seq = useRef(0);
  const set = (p: Partial<Form>) => setF((x) => ({ ...x, ...p }));

  // 입력이 바뀌면 잠깐 기다렸다가 다시 계산한다. 늦게 온 옛 응답은 버린다.
  // 입력이 틀리거나 계산이 실패하면 이전 금액을 지운다(지금 조건의 견적처럼 보이지 않게)
  useEffect(() => {
    const b = body(f);
    if (!b) {
      seq.current++;
      setQ(null);
      setBusy(false);
      setErr(!(f.dobae || f.mokgong) ? "도배나 목공 중 하나는 골라 주세요." : f.mode === "py" ? "평형을 넣어 주세요." : "면적을 넣어 주세요.");
      return;
    }
    const my = ++seq.current;
    const t = setTimeout(() => {
      setBusy(true);
      v2Post<Out>("market-quote", b).then(
        (r) => {
          if (my !== seq.current) return;
          setQ(r);
          setErr("");
          setBusy(false);
        },
        (e) => {
          if (my !== seq.current) return;
          setQ(null);
          setErr(errorText(e));
          setBusy(false);
        },
      );
    }, 300);
    return () => clearTimeout(t);
  }, [f]);

  // 폰 머리 'AI에게 묻기'(GuestAskButton)를 누르면 아래 시트를 연다
  useEffect(() => {
    const on = () => setAsk(true);
    window.addEventListener(GUEST_ASK_EVENT, on);
    return () => window.removeEventListener(GUEST_ASK_EVENT, on);
  }, []);
  const openJoin = () => { setAsk(false); setJoin(true); };

  const toggle = (key: OptKey) => {
    const cur = f.options ?? (q?.options.filter((o) => o.on).map((o) => o.key) ?? []);
    set({ options: cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key] });
  };

  return (
    <>
      <Main>
        <PageHead
          title="표준견적서"
          crumbs={[{ label: "표준견적서 받기", href: "/start" }, { label: "표준견적서" }]}
          desc={`업체 견적서 ${q?.quotes ?? 235}건에서 가장 흔한 단가로 계산해요.`}
        />
        <WithAside aside={<GuestAsk onJoin={openJoin} />}>
          {q ? <MarketTotal q={q} changeHref="#mq-cond" /> : err ? null : <StandardSkeleton />}

          <Conditions f={f} q={q} set={set} err={err} busy={busy} />

          {q ? <MarketSheet q={q} /> : null}
          {q && q.options.length ? <Options q={q} f={f} set={set} toggle={toggle} /> : null}
          {q ? <MarketTrust q={q} /> : null}
        </WithAside>
      </Main>
      {q ? (
        <BottomBar>
          <Button variant="secondary" size="lg" href="/start">내 집으로 다시 받기</Button>
          <Button size="lg" onClick={() => setJoin(true)}>업체 보기</Button>
        </BottomBar>
      ) : null}
      <GuestAskSheet open={ask} onClose={() => setAsk(false)} onJoin={openJoin} />
      <JoinDialog open={join} onClose={() => setJoin(false)} />
    </>
  );
}

/** 우리 집 조건: 크기 · 방 · 욕실 · 공정 · 벽지. 바꾸면 바로 다시 계산한다 */
function Conditions({ f, q, set, err, busy }: { f: Form; q: Out | null; set: (p: Partial<Form>) => void; err: string; busy: boolean }) {
  return (
    <section id="mq-cond" className={s.group} aria-labelledby="mq-cond-t">
      <h2 id="mq-cond-t" className={s.h2}>우리 집 조건</h2>
      <Segmented legend="집 크기 넣는 방법" value={f.mode} onChange={(v) => set({ mode: v as Form["mode"] })} options={[{ value: "py", label: "평형" }, { value: "m2", label: "면적(㎡)" }]} />
      {f.mode === "py" ? (
        <Field label="공급평형" num unit="평" value={f.py} onChange={(e) => set({ py: e.target.value })} />
      ) : (
        <div className={s.row2}>
          <SelectField label="면적 기준" value={f.basis} onChange={(e) => set({ basis: e.target.value as Form["basis"] })} options={[{ value: "exclusive", label: "전용면적" }, { value: "supply", label: "공급면적" }]} />
          <Field label="면적" num unit="㎡" value={f.m2} onChange={(e) => set({ m2: e.target.value })} />
        </div>
      )}
      <div className={s.row2}>
        <Field label="방" optional num unit="개" inputMode="numeric" value={f.rooms} placeholder={q?.rooms_auto ? `자동 ${q.rooms}` : "자동"} onChange={(e) => set({ rooms: e.target.value })} />
        <Field label="욕실" optional num unit="개" inputMode="numeric" value={f.baths} placeholder={q?.rooms_auto ? `자동 ${q.baths}` : "자동"} onChange={(e) => set({ baths: e.target.value })} />
      </div>
      <fieldset className={s.checks}>
        <legend className={s.lab}>할 공정</legend>
        <Check label="도배" checked={f.dobae} onChange={(on) => set({ dobae: on })} />
        <Check label="목공 (문 포함)" checked={f.mokgong} onChange={(on) => set({ mokgong: on })} />
      </fieldset>
      {f.dobae ? <Segmented legend="벽지" value={f.wallpaper} onChange={(v) => set({ wallpaper: v as Form["wallpaper"] })} options={WALLPAPER} /> : null}
      <p className={s.status} role="status" aria-live="polite">
        {err ? <span className={s.err}>{err}</span> : busy ? "다시 계산하는 중이에요…" : q?.area_note || ""}
      </p>
    </section>
  );
}

/** 줄 표: 공종마다 줄(수량 · 단가 · 금액) → 합계 표(순공사비 · 요율 · 공급가 + 부가세) */
export function MarketSheet({ q }: { q: Out }) {
  return (
    <section className={s.group} aria-labelledby="mq-lines">
      <h2 id="mq-lines" className={s.h2}>표준견적서 줄</h2>
      {q.trades.map((t) => (
        <div key={t.key} className={s.trade}>
          <h3 className={s.tradeHead}>
            <span>
              {t.name}
              <small className="mj-num">자재 {won(t.material)} · 인건비 {won(t.labor)} · 경비 {won(t.expense)}</small>
            </span>
            <b className="mj-num">{wonFull(t.total)}</b>
          </h3>
          <QuoteLines lines={tradeLines(t)} caption={`${t.name} 줄`} />
          <details className={s.why}>
            <summary>수량 · 단가 근거 보기</summary>
            <ul>
              {t.lines.map((l, i) => (
                <li key={`${l.item}-${i}`}>
                  <b>{l.name}</b>
                  <span>수량: {l.qty_why}</span>
                  <span>단가: {l.price_why}</span>
                  {l.note ? <span>※ {l.note}</span> : null}
                </li>
              ))}
            </ul>
          </details>
        </div>
      ))}
      <div className={s.trade}>
        <h3 className={s.tradeHead}><span>합계</span></h3>
        <QuoteLines lines={sumLines(q)} totals={{ supply: q.supply, vat: q.vat, total: q.total }} vatSplit caption="표준견적서 합계" />
      </div>
      <p className={s.ver}>기준 자료 {q.version} · 업체 견적 {q.quotes}건 중앙값 · 양식 요율: 회사이윤 · 공과잡비 · 산재 · 고용보험료</p>
    </section>
  );
}

/** 목공 선택 항목: 켜고 끄면 총액이 바로 바뀐다. 금액은 그 항목 때문에 늘거나 주는 총액(부가세 포함) */
function Options({ q, f, set, toggle }: { q: Out; f: Form; set: (p: Partial<Form>) => void; toggle: (k: OptKey) => void }) {
  const groups = [
    { title: "대부분 하는 것", sub: `업체 견적 ${q.quotes}건 중 80% 넘게 들어 있어요`, list: q.options.filter((o) => o.common) },
    { title: "필요하면 추가", sub: "집 상태를 보고 정해요", list: q.options.filter((o) => !o.common) },
  ].filter((g) => g.list.length);
  return (
    <section className={s.group} aria-labelledby="mq-opt">
      <div className={s.optHead}>
        <h2 id="mq-opt" className={s.h2}>목공에서 할 것 고르기</h2>
        {f.options !== null ? <Button variant="text" onClick={() => set({ options: null })}>많이 하는 대로 되돌리기</Button> : null}
      </div>
      <p className={s.guide}>
        <b>{q.options.filter((o) => o.on).length}개</b> 골랐어요 · 목공 공사비 <b className="mj-num">{won(q.trades.find((t) => t.key === "mokgong")?.total ?? 0)}</b>. 체크를 켜고 끄면 총액이 바로 바뀌어요.
      </p>
      {groups.map((g) => (
        <div key={g.title}>
          <h3 className={s.optGroupT}>{g.title} <span>{g.sub}</span></h3>
          <ul className={s.optList}>
            {g.list.map((o) => (
              <li key={o.key} className={`${s.optRow} ${o.on ? s.optOn : ""}`}>
                <label className={s.optMain}>
                  <input type="checkbox" className={s.optBox} checked={o.on} onChange={() => toggle(o.key)} />
                  <span className={s.optText}>
                    <b>{o.name}</b>
                    <span>{o.desc}</span>
                    <small>업체 견적 {q.quotes}건 중 {o.seen}건에 들어 있어요</small>
                  </span>
                  <span className={`mj-num ${s.optPrice}`}>
                    <small>{o.on ? "포함" : "추가하면"}</small>
                    <b>{o.on ? won(-o.delta) : `+${won(o.delta)}`}</b>
                  </span>
                </label>
                {o.on && o.key === "doors" ? (
                  <div className={s.optSub}>
                    <Segmented legend={`문짝 종류 · 문 ${q.doors}개 (방 ${q.rooms} + 욕실 ${q.baths})`} value={f.door} onChange={(v) => set({ door: v as Form["door"] })} options={DOOR} />
                  </div>
                ) : null}
                {o.on && o.key === "jungmun" ? (
                  <div className={s.optSub}>
                    <Segmented legend="중문 종류" value={f.jungmun} onChange={(v) => set({ jungmun: v as Form["jungmun"] })} options={JUNGMUN} />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

/** 믿어도 될까요 · 용어 */
export function MarketTrust({ q }: { q: Out }) {
  return (
    <>
      <section className={s.group} aria-labelledby="mq-trust">
        <h2 id="mq-trust" className={s.h2}>이 금액을 믿어도 될까요?</h2>
        <ol className={s.checkList}>
          <li>단가는 실제 업체 견적서 {q.quotes}건에서 가장 흔한 값(중앙값)이에요.</li>
          <li>수량은 평형 × {q.quotes}건의 평균 비율로 어림했어요. 실측하면 집 구조에 따라 달라져요.</li>
          <li>인건비는 &lsquo;사람 수 × 하루 품삯&rsquo;이에요. 도배공 하루 30만 원, 목수 하루 35만 원이 업체 견적에서 가장 흔했어요.</li>
          <li>기존 벽지 · 몰딩 철거, 폐기물 처리, 짐 옮기기는 이 견적에 없어요. 업체 견적에 따로 있는지 확인하세요.</li>
          <li>업체 견적이 이보다 크게 높거나 낮으면, 빠지거나 더해진 줄이 있는지 이 표와 줄마다 맞춰 보세요.</li>
        </ol>
      </section>
      <section className={s.group} aria-labelledby="mq-words">
        <h2 id="mq-words" className={s.h2}>용어 사전</h2>
        <dl className={s.glossary}>
          {GLOSSARY.map(([t, d]) => (
            <div key={t}>
              <dt>{t}</dt>
              <dd>{d}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}
