"use client";
// 빠른 예산 카드: 집(카드 또는 평형) · 어디 · 바꿀 것 · 도배 유형만 묻고 시장 범위를 보여 준다.
// 금액 · 기본값 · '더 정확히' 순서는 모두 /v2/quick-budget(계산 엔진) 응답 그대로다. 화면은 계산하지 않는다.
import { useEffect, useRef, useState } from "react";
import type { components } from "@/lib/backend/schema";
import { errorText } from "@/lib/backend/client";
import { v2Post } from "../api";
import { loadPlans, type PlanBrief, plansState, pp9PyBand } from "../intake/plans";
import type { QuickAns } from "../store";
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
const BANDS = ["20", "25", "30", "34", "40"];

const man = (n: number) => `${(n / 10000).toLocaleString("ko-KR")}만`;
export const rangeText = (lo: number, hi: number) => `약 ${man(lo)}~${man(hi)} 원`;

/** 평형대마다 실제 평면 하나 (목록 순서의 첫 집) */
function samples(list: PlanBrief[]) {
  return BANDS.map((b) => list.find((p) => pp9PyBand(p.supply_py) === b)).filter((p): p is PlanBrief => !!p);
}
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
    grade: a.grade, ceiling: a.ceiling, occupied: a.occupied,
  };
}
const ready = (a: QuickAns) => (a.plan != null || (a.pyeong != null && a.pyeong >= 5)) && (a.dobae || a.molding || a.base || (a.door != null && a.door !== "none"));

export function QuickCard({ init, onQuote, onAsk }: { init: QuickAns; onQuote: (a: QuickAns, planId: string | null) => void; onAsk: (q: string) => void }) {
  const [a, setA] = useState<QuickAns>(init);
  const [list, setList] = useState<PlanBrief[]>(plansState.list ?? []);
  const [out, setOut] = useState<QuickOut | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [typing, setTyping] = useState(init.plan == null && init.pyeong != null);
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

  const cards = samples(list);
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
        <legend>1. 어떤 집이에요?</legend>
        <p className="muted">비슷한 집을 고르면 실제 평면으로 재요. 평형만 넣어도 돼요.</p>
        <div className={s.homes}>
          {cards.map((p) => (
            <button key={p.id} type="button" className={s.home} aria-pressed={a.plan === p.id} onClick={() => { setTyping(false); set({ plan: a.plan === p.id ? null : p.id, pyeong: null }); }}>
              <b>{p.supply_py}평</b>
              <span>{`방 ${p.rooms} · 욕실 ${p.baths}`}</span>
              <small>{`예: ${p.name} ${p.type}`}</small>
            </button>
          ))}
          <button type="button" className={s.home} aria-pressed={typing} onClick={() => { setTyping(true); set({ plan: null }); }}>
            <b>직접 넣기</b>
            <span>평형을 알아요</span>
          </button>
        </div>
        {typing ? (
          <div className="row">
            <label className={s.py}>
              <input type="number" inputMode="decimal" min={5} max={150} value={a.pyeong ?? ""} placeholder="32" aria-label="평형" onChange={(e) => set({ pyeong: e.target.value ? Number(e.target.value) : null })} />
              평
            </label>
            <div className="seg" role="group" aria-label="면적 기준">
              {(["supply", "exclusive"] as const).map((b) => (
                <button key={b} type="button" aria-pressed={a.basis === b} onClick={() => set({ basis: b })}>{b === "supply" ? "공급(분양 평형)" : "전용"}</button>
              ))}
            </div>
          </div>
        ) : null}
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

      <fieldset className={s.q}>
        <legend>3. 무엇을 바꿔요?</legend>
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

      {a.dobae ? (
        <fieldset className={s.q}>
          <legend>4. 도배는 어떤 유형이에요?</legend>
          <div className={s.grades}>
            <button type="button" className={s.grade} aria-pressed={a.grade === "basic"} onClick={() => set({ grade: "basic" })}>
              <b>기본형 · 실크</b>
              <span>비닐 코팅이라 물걸레로 닦여요. 아이 있는 집 · 오래 살 집이 많이 골라요.</span>
            </button>
            <button type="button" className={s.grade} aria-pressed={a.grade === "economy"} onClick={() => set({ grade: "economy" })}>
              <b>저가형 · 합지</b>
              <span>종이 벽지라 값이 낮아요. 세 놓을 집 · 짧게 살 집이 많이 골라요.</span>
            </button>
            <button type="button" className={s.grade} aria-pressed={a.grade == null} onClick={() => set({ grade: null })}>
              <b>잘 모르겠어요</b>
              <span>둘 다 보여 드릴게요. 제품 · 색은 실측 때 샘플북으로 골라요.</span>
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

const TRADE_KO = { dobae: "도배", mokgong: "목공(몰딩 · 걸레받이 · 문)" } as const;

function Result({ out, a, busy, set, onQuote, onAsk }: { out: QuickOut; a: QuickAns; busy: boolean; set: (p: Partial<QuickAns>) => void; onQuote: () => void; onAsk: (q: string) => void }) {
  const pick = (key: string, v: string) => {
    if (key === "door") set({ door: v as QuickAns["door"] });
    else if (key === "grade") set({ grade: v as QuickAns["grade"] });
    else set({ [key]: v === "true" } as Partial<QuickAns>);
  };
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
      <ul className={s.trades}>
        {out.trades.map((t) => (
          <li key={t.trade}>
            <span>{TRADE_KO[t.trade]}</span>
            <span className="num">{rangeText(t.lo, t.hi)}</span>
            <small>{`실견적 ${t.n}건 근거`}</small>
          </li>
        ))}
      </ul>
      <details className={s.how}>
        <summary>이렇게 봤어요</summary>
        <ul>
          {out.assumed.map((x) => <li key={x}>{x}</li>)}
        </ul>
      </details>
      {out.asks.length ? (
        <div className={s.asks}>
          <b>더 정확히 하려면</b>
          {out.asks.map((q) => (
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
