"use client";
// 견적서 · 공정표 단계 (v10 quoteStep · openQuoteDoc · explainQuote · bandWhy(v5) · schedStep · openPlanDoc · schedAgent).
// 계산은 API(quote · plan)가 하고, AI 설명은 F.agentAnswer → 서버(/v2/ask)가 지시문 · 계산 · 숫자 검사까지 맡는다.
import { useEffect, useState } from "react";
import { errorText } from "@/lib/backend/client";
import { bot, F, me, openOverlay, quick } from "../engine";
import { setStep } from "../flow";
import { V3 } from "../store";
import { type Plan, planBody, type Quote, quoteBody } from "./api";
import { ensureQuote, GanttEl, loadPlan, PlanDocBody } from "./PlanDoc";
import { QuoteCheck } from "./QuoteCheck";
import { loadQuote, QuoteDocBody } from "./QuoteDoc";
import { approxMan, DocShell, fmt, manRange, mdw } from "./shared";

const FAIL = "설명을 만들지 못했어요. 계산 결과는 견적서에서 그대로 볼 수 있어요.";
const Spark = () => <span className="spark" aria-hidden="true">✦</span>;

/* ---------- 견적서 ---------- */
function QuoteSumCard({ q }: { q: Quote }) {
  const names = [...q.precise.map((t) => t.ko), ...q.ref.map((t) => t.ko)];
  return (
    <div className="card v3sum">
      <div>
        <h3>표준견적서</h3>
        <p className="muted">{`${q.inp.py}평${q.inp.measured ? ` · 도면 ${q.inp.measured.name} 수량` : ""} · ${names.join(" · ")}`}</p>
      </div>
      <div className="kpi main">
        <span>{`예상 공사비 (${q.precise.length + q.ref.length}개 공정)`}</span>
        <b className="num">{q.ref.length ? manRange(q.all_lo, q.all_hi) : approxMan(q.total)}</b>
        <small>부가세 포함 · 실측 뒤 달라질 수 있어요</small>
      </div>
      <details className="v3more">
        <summary>금액 자세히</summary>
        {q.precise.length ? (
          <div className="kpi">
            <span>{`공공 기준 (${q.precise.map((t) => t.ko).join(" · ")})`}</span>
            <b className="num">{approxMan(q.total)}</b>
            <small>{`${fmt(q.total)}원 · 부가세 포함 · 표준시장단가로 계산`}</small>
          </div>
        ) : null}
        {q.band ? (
          <div className="kpi band">
            <span>업체 견적은 보통 (부가세 별도)</span>
            <b className="num">{manRange(q.band.lo, q.band.hi)}</b>
            <small>{"2025~2026 실견적으로 맞춘 시장 기준 · '왜 달라요?'"}</small>
          </div>
        ) : null}
        {q.ref.length ? (
          <div className="kpi">
            <span>{`참고 금액 (${q.ref.length}개 공정)`}</span>
            <b className="num">{manRange(q.rlo, q.rhi)}</b>
            <small>부가세 포함 · 시장 근거 · 업체 견적 아님</small>
          </div>
        ) : null}
      </details>
      {q.inp.assumed.length ? <p className="muted">{q.inp.assumed.join(" · ")}</p> : null}
      <div className="row">
        <button type="button" className="btn btn-pri" onClick={() => openQuoteDoc()}>견적서 열기</button>
        <button type="button" className="btn-text" onClick={() => explainQuote()}>
          <Spark />
          금액 풀이 듣기
        </button>
      </div>
    </div>
  );
}

export async function quoteStep() {
  setStep("quote");
  let q: Quote;
  try {
    q = await loadQuote();
  } catch (e) {
    await bot(`표준견적서를 계산하지 못했어요. ${errorText(e)}`);
    quick([["다시 해 보기", () => quoteStep()]]);
    return;
  }
  await bot("표준견적서가 나왔어요.", <QuoteSumCard q={q} />);
  quick([
    ["공정표 보기", () => schedStep()],
    ["계약 전 점검", () => F.checkStep?.("contract")],
    ["왜 이 금액이에요?", () => explainQuote()],
    ...(q.band ? ([["왜 달라요?", () => bandWhy()]] as [string, () => void][]) : []),
  ]);
}

export function openQuoteDoc() {
  openOverlay((close) => <DocShell title="표준견적서" close={close}>{() => <QuoteDocBody />}</DocShell>);
}

/** 견적 설명 에이전트: 저장된 금액을 풀이만 한다. 서버가 같은 입력으로 견적을 다시 계산해 설명하고 숫자를 검사한다 */
export async function explainQuote(question?: string) {
  try {
    if (!V3.quote) await loadQuote();
  } catch (e) {
    await bot(`표준견적서를 계산하지 못했어요. ${errorText(e)}`);
    return;
  }
  const ask = question || "이 표준견적서 금액이 어떻게 나왔는지 쉽게 풀어 주세요. 가장 큰 줄 두세 개와 실측 뒤 바뀔 수 있는 것을 알려 주세요.";
  if (!F.agentAnswer) {
    if (!question) me("금액 풀이");
    await bot(FAIL);
    return;
  }
  await F.agentAnswer({ label: question ? null : "금액 풀이", ask, kind: "quote_explanation", quote: quoteBody() });
}

/** '왜 달라요?' 대화 카드: 공정마다 가장 큰 이유 3개 (v5) */
export async function bandWhy() {
  let q: Quote;
  try {
    q = (V3.quote as Quote | null) ?? (await loadQuote());
  } catch {
    return;
  }
  if (!q.band) return;
  me("왜 달라요?");
  const cards = q.precise.map((t) => {
    const g = t.gap;
    if (!g) return null;
    const top = [...g.steps].sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 3);
    return (
      <li key={t.trade}>
        <b>{t.ko}</b>
        {` 표준견적서 ${approxMan(g.from)} → 시장 기준 ${approxMan(g.to)}(부가세 별도). 큰 이유: ` +
          top.map((s) => `${s.name} ${s.d > 0 ? "+" : "−"}${Math.round(Math.abs(s.d) / 10000).toLocaleString("ko-KR")}만 원`).join(" · ")}
      </li>
    );
  });
  await bot(
    "표준견적서는 공공 기준(표준시장단가 · 시중노임단가)으로 계산해서 업체 견적과 달라요. 그래서 같은 줄에 시장 값을 넣은 '시장 기준'을 같이 보여요.",
    <div className="card">
      <ul className="notes band-why">{cards}</ul>
      <p className="muted">시장 기준은 2025~2026년에 공개된 실견적(숨고 · 커뮤니티 · 블로그 · 업체 사이트)과 시장 조사로 맞췄어요. 지역 · 업체 · 자재마다 달라요.</p>
      <p className="muted">업체 견적을 받으면 견적서의 [받은 견적 맞춰 보기]에 넣어 보세요.</p>
    </div>,
  );
  quick([["견적서 열기", () => openQuoteDoc()], ["공정표 보기", () => schedStep()]]);
}

/** 받은 견적 맞춰 보기를 다른 곳(체크리스트 · 계산기)에서 열 때. 견적이 없으면 받아 온다 */
function QuoteCheckCard({ q: given }: { q?: Quote }) {
  const [q, setQ] = useState<Quote | null>(given ?? (V3.quote as Quote | null) ?? null);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!q) loadQuote().then(setQ, (e) => setErr(errorText(e)));
  }, []);
  if (!q) return <p className="muted">{err || "견적서를 계산하는 중이에요…"}</p>;
  if (!q.precise.length) return <p className="muted">도배 · 목공을 고르면 받은 견적을 맞춰 볼 수 있어요.</p>;
  return (
    <div className="card">
      <QuoteCheck q={q} />
    </div>
  );
}
export const quoteCheckCard = (q?: Quote) => <QuoteCheckCard q={q} />;

/* ---------- 공정표 ---------- */
function PlanCard({ p, title }: { p: Plan; title?: boolean }) {
  return (
    <div className="card v3sum">
      {title ? (
        <div>
          <h3>예상 공정표</h3>
          <p className="muted">{`${mdw(p.start)} ~ ${mdw(p.end)} · 일하는 날 ${p.work_days}일 · ${V3.cons.weekendWork ? "공휴일만 쉬어요" : "주말 · 공휴일은 쉬어요"}`}</p>
        </div>
      ) : (
        <p className="muted">{`바뀐 공정표 · ${p.start} ~ ${p.end} · 일하는 날 ${p.work_days}일`}</p>
      )}
      <GanttEl p={p} mini />
      {p.warn.length ? <p className="warn-line">{p.warn.join(" · ")}</p> : null}
      <div className="row">
        {title ? (
          <>
            <button type="button" className="btn btn-pri" onClick={() => openPlanDoc()}>공정표 열기</button>
            <button type="button" className="btn-text" onClick={() => schedAgent()}>
              <Spark />
              일정 조건 말하기
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-pri btn-sm" onClick={() => openPlanDoc()}>공정표 열기</button>
        )}
      </div>
    </div>
  );
}

export async function schedStep() {
  setStep("sched");
  let p: Plan;
  try {
    p = await loadPlan();
  } catch (e) {
    await bot(`공정표를 계산하지 못했어요. ${errorText(e)}`);
    quick([["다시 해 보기", () => schedStep()]]);
    return;
  }
  await bot("공사 순서대로 예상 날짜를 잡았어요.", <PlanCard p={p} title />);
  quick([
    ["공사 전 체크리스트", () => F.checkStep?.("before")],
    ["12월 안에 끝내고 싶어요", () => schedAgent("12월 안에 끝내고 싶어요")],
    ["주말에도 공사해도 돼요", () => schedAgent("주말에도 공사해도 돼요")],
    ["견적서 다시 보기", () => openQuoteDoc()],
  ]);
}

export function openPlanDoc() {
  openOverlay((close) => <DocShell title="공정표" close={close}>{() => <PlanDocBody />}</DocShell>);
}

/** 공정표 에이전트: 고객 말 → 제약(도구) → API가 다시 계산 → 결과만 설명 */
export async function schedAgent(text?: string) {
  const say = text;
  if (!say) {
    const el = document.getElementById("chat-in") as HTMLTextAreaElement | null;
    if (el) {
      el.focus();
      el.placeholder = "예: 12월 20일까지 끝내 주세요";
    }
    return;
  }
  try {
    await loadPlan();
  } catch (e) {
    me(say);
    await bot(`공정표를 계산하지 못했어요. ${errorText(e)}`);
    return;
  }
  if (!F.agentAnswer) {
    me(say);
    await bot(FAIL);
    return;
  }
  // 조건 바꾸기(set_schedule_constraints)와 날짜 계산은 서버가 한다. 바뀐 조건만 받아 V3.cons에 둔다
  const r = await F.agentAnswer({ label: say, ask: say, kind: "schedule", plan: planBody() });
  if (r?.cons) V3.cons = { ...r.cons, avoid: [...r.cons.avoid] };
  let p: Plan;
  try {
    p = await loadPlan();
  } catch {
    return r;
  }
  await bot(null, <PlanCard p={p} />);
  return r;
}

/** 견적 · 공정표를 받아 V3에 둔다 (다른 작업자가 도구에서 쓸 때) */
export const buildQuote = () => loadQuote();
export const buildPlan = () => loadPlan();
export { ensureQuote };
