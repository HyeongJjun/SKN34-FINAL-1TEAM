"use client";
// 빠른 예산 카드: 평수 · 어디 · 실크벽지 종류만 묻고 시장 범위를 보여 준다. 지금은 도배만 연다(data.ts SHOWN_CATS · SILKS).
// 금액 · 기본값 · '더 정확히' 순서는 모두 /v2/quick-budget(계산 엔진) 응답 그대로다. 화면은 계산하지 않는다.
import { useEffect, useRef, useState } from "react";
import type { components } from "@/lib/backend/schema";
import { errorText } from "@/lib/backend/client";
import { v2Post } from "../api";
import { DOBAE_ONLY, priceText, SILKS, type SilkKey } from "../data";
import { loadPlans, type PlanBrief, plansState } from "../intake/plans";
import { openSheet } from "../materials/Sheets";
import { matSrcs, Photo } from "../photo";
import { DATA, type QuickAns, useV2 } from "../store";
import s from "./budget.module.css";

export type QuickOut = components["schemas"]["V2QuickOut"];

export const freshAns = (): QuickAns => ({
  plan: null, pyeong: null, basis: "supply", kinds: null,
  dobae: true, molding: false, base: false, door: null, grade: null, ceiling: null, occupied: null,
});

/** 일부만 할 때 고르는 공간 → 도면 공간 종류 */
const PARTS: [string, string, string[]][] = [
  ["living", "거실", ["living"]],
  ["room", "방", ["room", "dress"]],
  ["kitchen", "주방", ["kitchen"]],
  ["entry", "현관 · 복도", ["entry", "hall"]],
];
/** 많이 묻는 평형. 누르면 칸에 넣는다 */
const PY = [24, 32, 34, 40];
/** 목공 쪽 '더 정확히' 질문 (도배만 열 때는 숨긴다) */
const MOK_KEYS = new Set(["molding", "base", "door"]);

const man = (n: number) => `${(n / 10000).toLocaleString("ko-KR")}만`;
export const rangeText = (lo: number, hi: number) => `약 ${man(lo)}~${man(hi)} 원`;

/** 평형만 넣고 '일부만'을 고르면 가장 가까운 평면으로 잰다 */
function nearest(list: PlanBrief[], py: number) {
  return [...list].sort((a, b) => Math.abs(a.supply_py - py) - Math.abs(b.supply_py - py))[0] ?? null;
}

function body(a: QuickAns, list: PlanBrief[]) {
  const planId = a.plan ?? (a.kinds && a.pyeong ? nearest(list, a.basis === "exclusive" ? a.pyeong * 1.2 : a.pyeong)?.id ?? null : null);
  return {
    pyeong: planId ? null : a.pyeong,
    area_basis: a.basis,
    plan: planId ? { id: planId, expanded: true, kinds: a.kinds } : null,
    dobae: a.dobae, molding: a.molding, base: a.base, door: a.door,
    grade: a.grade, paper: a.paper ?? null, ceiling: a.ceiling, occupied: a.occupied,
  };
}
const ready = (a: QuickAns) => (a.plan != null || (a.pyeong != null && a.pyeong >= 5)) && (a.dobae || a.molding || a.base || (a.door != null && a.door !== "none"));
/** 도배만 열 때는 예전에 고른 목공 답을 지우고, 집 카드 대신 평형으로 받는다 */
const onlyDobae = (a: QuickAns): QuickAns => (DOBAE_ONLY ? { ...a, plan: null, dobae: true, molding: false, base: false, door: null } : a);

export function QuickCard({ init, onQuote, onAsk }: { init: QuickAns; onQuote: (a: QuickAns, planId: string | null) => void; onAsk: (q: string) => void }) {
  const [a, setA] = useState<QuickAns>(() => onlyDobae(init));
  const [list, setList] = useState<PlanBrief[]>(plansState.list ?? []);
  const [out, setOut] = useState<QuickOut | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const asked = useRef(false);
  const seq = useRef(0);
  useEffect(() => {
    loadPlans().then(setList, () => setList([]));
  }, []);
  const set = (p: Partial<QuickAns>) => setA((x) => ({ ...x, ...p }));

  const run = async (x: QuickAns) => {
    const n = ++seq.current;
    setBusy(true);
    setErr("");
    try {
      const r = await v2Post<QuickOut>("quick-budget", body(x, list));
      if (n === seq.current) setOut(r);
    } catch (e) {
      if (n === seq.current) setErr(errorText(e));
    } finally {
      if (n === seq.current) setBusy(false);
    }
  };
  // 한 번 금액을 본 뒤에는 답을 바꿀 때마다 다시 계산한다
  useEffect(() => {
    if (!asked.current || !ready(a)) return;
    const t = setTimeout(() => run(a), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a]);

  const auto = a.plan == null && a.kinds && a.pyeong ? nearest(list, a.basis === "exclusive" ? a.pyeong * 1.2 : a.pyeong) : null;
  const toggleKind = (ks: string[]) => {
    const cur = new Set(a.kinds ?? []);
    const on = ks.every((k) => cur.has(k));
    ks.forEach((k) => (on ? cur.delete(k) : cur.add(k)));
    set({ kinds: cur.size ? [...cur] : [] });
  };
  const door = a.door != null && a.door !== "none";

  return (
    <div className={`card ${s.quick}`}>
      <fieldset className={s.q}>
        <legend>1. 몇 평이에요?</legend>
        <div className="row">
          <label className={s.py}>
            <input type="number" inputMode="decimal" min={5} max={150} value={a.pyeong ?? ""} placeholder="32" aria-label="평형" onChange={(e) => set({ plan: null, pyeong: e.target.value ? Number(e.target.value) : null })} />
            평
          </label>
          <div className="chips">
            {PY.map((p) => (
              <button key={p} type="button" className="chip" aria-pressed={a.pyeong === p} onClick={() => set({ plan: null, pyeong: p, basis: "supply" })}>{`${p}평`}</button>
            ))}
          </div>
        </div>
        <p className="muted">분양 평형(공급면적) 기준이에요.</p>
      </fieldset>

      <fieldset className={s.q}>
        <legend>2. 어디를 해요?</legend>
        <div className="seg lg" role="group" aria-label="공사 범위">
          <button type="button" aria-pressed={a.kinds == null} onClick={() => set({ kinds: null })}>집 전체</button>
          <button type="button" aria-pressed={a.kinds != null} onClick={() => set({ kinds: a.kinds ?? ["living"] })}>일부만</button>
        </div>
        {a.kinds != null ? (
          <>
            <div className="chips">
              {PARTS.map(([id, ko, ks]) => (
                <button key={id} type="button" className="chip" aria-pressed={ks.every((k) => a.kinds?.includes(k))} onClick={() => toggleKind(ks)}>{ko}</button>
              ))}
            </div>
            {auto ? <p className="muted">{`${auto.supply_py}평 ${auto.name} ${auto.type} 평면에서 고른 공간만 재요.`}</p> : null}
          </>
        ) : null}
      </fieldset>

      {DOBAE_ONLY ? null : (
        <fieldset className={s.q}>
          <legend>무엇을 바꿔요?</legend>
          <div className="chips">
            <button type="button" className="chip" aria-pressed={a.dobae} onClick={() => set({ dobae: !a.dobae })}>도배</button>
            <button type="button" className="chip" aria-pressed={a.molding} onClick={() => set({ molding: !a.molding })}>천장 몰딩</button>
            <button type="button" className="chip" aria-pressed={a.base} onClick={() => set({ base: !a.base })}>걸레받이</button>
            <button type="button" className="chip" aria-pressed={door} onClick={() => set({ door: door ? null : "frame" })}>방문</button>
          </div>
          {door ? (
            <div className="seg" role="group" aria-label="방문 바꾸는 범위">
              <button type="button" aria-pressed={a.door === "leaf"} onClick={() => set({ door: "leaf" })}>문짝만</button>
              <button type="button" aria-pressed={a.door === "frame"} onClick={() => set({ door: "frame" })}>문틀까지</button>
            </div>
          ) : null}
        </fieldset>
      )}

      {a.dobae && DOBAE_ONLY ? (
        <fieldset className={s.q}>
          <legend>3. 어떤 실크벽지예요?</legend>
          <SilkTiles value={a.paper} onPick={(paper) => set({ paper })} />
        </fieldset>
      ) : a.dobae ? (
        <fieldset className={s.q}>
          <legend>3. 도배는 어떤 유형이에요?</legend>
          <div className={s.grades}>
            <button type="button" className={s.grade} aria-pressed={a.grade === "basic"} onClick={() => set({ grade: "basic" })}>
              <b>기본형 · 실크</b>
              <span>물걸레로 닦여요</span>
            </button>
            <button type="button" className={s.grade} aria-pressed={a.grade === "economy"} onClick={() => set({ grade: "economy" })}>
              <b>저가형 · 합지</b>
              <span>값이 낮아요</span>
            </button>
            <button type="button" className={s.grade} aria-pressed={a.grade == null} onClick={() => set({ grade: null })}>
              <b>잘 모르겠어요</b>
              <span>둘 다 보여 드려요</span>
            </button>
          </div>
        </fieldset>
      ) : null}

      {!out ? (
        <button type="button" className="btn btn-pri" disabled={!ready(a) || busy} onClick={() => { asked.current = true; run(a); }}>
          {busy ? "계산하는 중이에요" : "금액 보기"}
        </button>
      ) : null}
      {err ? <p className={s.err} role="alert">{`금액을 계산하지 못했어요. ${err}`}</p> : null}
      {out ? <Result out={out} a={a} busy={busy} set={set} onQuote={() => onQuote(a, body(a, list).plan?.id ?? null)} onAsk={onAsk} /> : null}
    </div>
  );
}

/** 자재 고르기 화면의 벽지 카드(사진 · 이름 · 평당 값 · 자세히)로 실크벽지 두 종류를 고른다. 고른 것은 표준견적서 벽지 자재가 된다 */
function SilkTiles({ value, onPick }: { value: SilkKey | null | undefined; onPick: (k: SilkKey | null) => void }) {
  useV2(); // 자재 자료(data.json)를 다 읽으면 사진 · 값을 채운다
  return (
    <div className={s.silks}>
      <div className={`mgrid ${s.silkGrid}`}>
        {SILKS.map((x) => {
          const m = DATA.materials.find((y) => y.id === x.id);
          const pick = () => onPick(x.key);
          return (
            <div
              key={x.key}
              className="mcard"
              role="button"
              tabIndex={0}
              aria-pressed={value === x.key}
              aria-label={`${x.ko} ${m ? priceText(m.price) : ""} ${value === x.key ? "고름" : "고르기"}`}
              onClick={pick}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  pick();
                }
              }}
            >
              {m ? (
                <Photo srcs={matSrcs(m)} alt={m.name}>
                  <span className="sel" aria-hidden="true">✓</span>
                </Photo>
              ) : null}
              <div className="in">
                <span className="brand">{m?.brand ?? "LX Z:IN · 개나리벽지"}</span>
                <span className="nm">{x.ko}</span>
                <span className="why">{x.sub}</span>
                <div className="meta">
                  <span className="price">{m ? priceText(m.price, false) : ""}</span>
                  {m?.price?.unit ? <span className="flag">{`/ ${m.price.unit}`}</span> : null}
                </div>
                {m ? (
                  <button
                    type="button"
                    className="btn-text"
                    style={{ minHeight: 40 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      openSheet(m);
                    }}
                  >
                    자세히
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <button type="button" className="chip" aria-pressed={value == null} onClick={() => onPick(null)}>
        잘 모르겠어요 · 둘 다 보여 드려요
      </button>
      <small className="muted">값은 벽지 자재값만이에요(평당, 업체 견적서 기준). 색 · 무늬는 실측 때 샘플북으로 골라요.</small>
    </div>
  );
}

const TRADE_KO = { dobae: "도배", mokgong: "목공(몰딩 · 걸레받이 · 문)" } as const;

function Result({ out, a, busy, set, onQuote, onAsk }: { out: QuickOut; a: QuickAns; busy: boolean; set: (p: Partial<QuickAns>) => void; onQuote: () => void; onAsk: (q: string) => void }) {
  const pick = (key: string, v: string) => {
    if (key === "door") set({ door: v as QuickAns["door"] });
    else if (key === "grade") set({ grade: v as QuickAns["grade"] });
    else if (key === "paper") set({ paper: v as QuickAns["paper"] });
    else set({ [key]: v === "true" } as Partial<QuickAns>);
  };
  const asks = DOBAE_ONLY ? out.asks.filter((q) => !MOK_KEYS.has(q.key)) : out.asks;
  return (
    <section className={s.result} aria-live="polite" aria-busy={busy}>
      <p className={s.big}>{rangeText(out.lo, out.hi)}</p>
      <p className="muted">부가세 포함 · 실제 견적의 가운데 절반이 들어오는 범위예요. 둘 중 하나는 이 범위 밖일 수 있어요.</p>
      {out.alt ? (
        <p className={s.alt}>
          <span>{out.alt.label}</span>
          <b>{rangeText(out.alt.lo, out.alt.hi)}</b>
        </p>
      ) : null}
      {out.trades.length > 1 ? (
        <ul className={s.trades}>
          {out.trades.map((t) => (
            <li key={t.trade}>
              <span>{TRADE_KO[t.trade]}</span>
              <span className="num">{rangeText(t.lo, t.hi)}</span>
              <small>{`실견적 ${t.n}건 근거`}</small>
            </li>
          ))}
        </ul>
      ) : out.trades[0] ? (
        <p className="muted">{`도배 실견적 ${out.trades[0].n}건으로 잡은 범위예요.`}</p>
      ) : null}
      <details className={s.how}>
        <summary>이렇게 봤어요</summary>
        <ul>
          {out.assumed.map((x) => <li key={x}>{x}</li>)}
        </ul>
      </details>
      {asks.length ? (
        <div className={s.asks}>
          <b>더 정확히 하려면</b>
          {asks.map((q) => (
            <div key={q.key} className={s.ask}>
              <span>{q.q}</span>
              <div className="chips">
                {q.choices.map((c) => (
                  <button key={c.value} type="button" className="chip sm" onClick={() => pick(q.key, c.value)}>
                    {c.label}
                    <span className="n">{rangeText(c.lo, c.hi)}</span>
                  </button>
                ))}
              </div>
              {q.note ? <small className="muted">{q.note}</small> : null}
            </div>
          ))}
        </div>
      ) : null}
      {a.ceiling === false ? <p className="muted">표준견적서는 아직 천장을 빼지 못해 천장 포함으로 계산돼요.</p> : null}
      <div className="row">
        <button type="button" className="btn btn-pri" onClick={onQuote}>이 조건으로 표준견적서 만들기</button>
        <button type="button" className="btn" onClick={() => onAsk("이 범위에서 금액이 갈리는 건 뭐예요?")}>금액이 왜 갈려요?</button>
      </div>
    </section>
  );
}
