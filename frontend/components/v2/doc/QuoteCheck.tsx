"use client";
// 받은 견적 맞춰 보기 (v5 quoteCheck + 2816 덧씌움: 범위 위치 막대). 도구에서 연다. 점검표는 체크리스트 '계약 전'으로 옮겼다.
// 받은 금액의 부가세 빼기 · 시장 기준 범위 · 추가 항목 범위 · 판정 · 안내 · 막대 위치는 API check가 만든다. 화면은 칸 값을 보내고 보이기만 한다.
import { useEffect, useState } from "react";
import { errorText } from "@/lib/backend/client";
import { type CheckReq, type CheckRes, fetchCheck, type MarketExtra, marketExtras, type Quote, quoteBody } from "./api";
import { Fld, fmt } from "./shared";

/** 맞춰 본 기록 (v10 V5.checks) */
export const V5 = { checks: [] as { trade: string; supply: number; lo: number; hi: number; where: string }[] };

type Out = { warn: string } | { res: CheckRes } | null;

export function QuoteCheck({ q }: { q: Quote }) {
  const [sel, setSel] = useState(q.precise[0]?.trade ?? "");
  const [amt, setAmt] = useState("");
  const [mode, setMode] = useState<CheckReq["mode"]>("unknown");
  const [on, setOn] = useState<Record<string, boolean>>({ ceiling: true });
  const [cnt, setCnt] = useState<Record<string, string>>({});
  const [out, setOut] = useState<Out>(null);
  const [extras, setExtras] = useState<MarketExtra[]>([]);
  useEffect(() => {
    marketExtras().then(setExtras, () => setExtras([]));
  }, []);
  if (!q.precise.length) return null;
  const pick = (v: string) => {
    setSel(v);
    setOn(v === "dobae" ? { ceiling: true } : {});
    setCnt({});
    setOut(null);
  };
  const chk = (key: string, label: string) => (
    <label className="chk" key={key}>
      <input type="checkbox" data-k={key} checked={!!on[key]} onChange={(e) => setOn({ ...on, [key]: e.target.checked })} />
      {label}
    </label>
  );
  // 금액은 만 원 단위로 받는다 (견적서에 보통 '250만 원'처럼 적혀 있다). 원으로 바꿔 API에 보낸다
  const won = Math.round((+amt || 0) * 10000);
  const tog = (key: string, label: string) => (
    <button key={key} type="button" className="chip" aria-pressed={!!on[key]} onClick={() => setOn({ ...on, [key]: !on[key] })}>
      {on[key] ? "✓ " : ""}
      {label}
    </button>
  );
  const go = async () => {
    const ex: Record<string, number> = {};
    for (const e of extras) if (on["x-" + e.key]) ex[e.key] = Math.max(1, Math.min(9, Math.round(+(cnt["x-" + e.key] || 1))));
    const scope = sel === "dobae" ? { ceiling: !!on.ceiling, removal: !!on.removal, moving: !!on.moving } : { casing9: !!on.casing9, removal: !!on.removal, etc: !!on.etc, extras: ex };
    try {
      const res = await fetchCheck({ quote: quoteBody(), trade: sel, amount: won, mode, scope });
      if (res.warn) return setOut({ warn: res.warn });
      if (res.supply != null && res.lo != null && res.hi != null && res.where) V5.checks.push({ trade: res.trade, supply: res.supply, lo: res.lo, hi: res.hi, where: res.where });
      setOut({ res });
    } catch (e) {
      setOut({ warn: errorText(e) });
    }
  };
  return (
    <section className="doc-trade qc">
      <h4 className="doc-sec">
        받은 견적 맞춰 보기<small>같은 평수 · 범위의 시장 기준과 비교해요</small>
      </h4>
      <div className="form-grid">
        {q.precise.length > 1 ? (
          <Fld label="공정">
            <select className="sort" aria-label="공정" value={sel} onChange={(e) => pick(e.target.value)}>
              {q.precise.map((t) => <option key={t.trade} value={t.trade}>{t.ko}</option>)}
            </select>
          </Fld>
        ) : null}
        <Fld label="받은 금액">
          <span className="qc-amt">
            <input className="inp" type="number" min="0" step="1" inputMode="decimal" placeholder="예: 250" aria-label="받은 견적 금액(만 원)" value={amt} onChange={(e) => setAmt(e.target.value)} />
            <span>만 원</span>
          </span>
        </Fld>
      </div>
      {won ? <p className="muted qc-won">{`${fmt(won)}원으로 맞춰 봐요`}</p> : null}
      <div className="seg" role="group" aria-label="부가세">
        {([["unknown", "부가세 모름"], ["excluded", "부가세 별도"], ["included", "부가세 포함"]] as const).map(([v, ko]) => (
          <button key={v} type="button" aria-pressed={mode === v} onClick={() => setMode(v as CheckReq["mode"])}>{ko}</button>
        ))}
      </div>
      {sel === "dobae" ? (
        <div className="qc-incl">
          <b>견적에 들어 있는 것</b>
          <span className="muted">견적서에 적힌 것만 눌러 켜 주세요</span>
          <div className="chips">
            {[tog("ceiling", "천장 도배"), tog("removal", "기존 벽지 철거"), tog("moving", "짐 이동 · 정리")]}
          </div>
        </div>
      ) : null}
      <div className="doc-opts">
        {sel === "dobae"
          ? null
          : [
              chk("casing9", "9mm 문선으로"),
              chk("removal", "철거 · 폐기물 포함"),
              ...extras.map((e) =>
                e.per === "곳" ? (
                  <label className="chk" key={"x-" + e.key}>
                    <input type="checkbox" data-k={"x-" + e.key} checked={!!on["x-" + e.key]} onChange={(x) => setOn({ ...on, ["x-" + e.key]: x.target.checked })} />
                    {e.name}
                    <input
                      className="inp cnt"
                      type="number"
                      min="1"
                      max="9"
                      value={cnt["x-" + e.key] ?? "1"}
                      data-c={"x-" + e.key}
                      aria-label={e.name + " 곳 수"}
                      onChange={(x) => setCnt({ ...cnt, ["x-" + e.key]: x.target.value })}
                    />
                    곳
                  </label>
                ) : (
                  chk("x-" + e.key, e.name)
                ),
              ),
              chk("etc", "그 밖의 목공(수납장 · 붙박이 · 천장 전체 등) 포함"),
            ]}
      </div>
      <div className="row">
        <button type="button" className="btn btn-pri" disabled={!won} onClick={go}>맞춰 보기</button>
      </div>
      <div className="qc-out" aria-live="polite">
        {out && "warn" in out ? <p className="warn-line">{out.warn}</p> : out ? <Result res={out.res} /> : null}
      </div>
    </section>
  );
}

function Result({ res }: { res: CheckRes }) {
  const bar = res.bar;
  return (
    <div className={"qc-res qc-" + res.where}>
      <b>{res.head}</b>
      {bar ? (
        <div className="qc-bar" aria-hidden="true">
          <i className="qc-band" style={{ left: `${bar.band_left}%`, width: `${bar.band_width}%` }} />
          <i className="qc-me" style={{ left: `${bar.me}%` }} />
          <em className="qc-me-l" style={{ left: `${bar.me}%` }}>받은 금액</em>
          <span className="l">낮음</span>
          <span className="r">높음</span>
        </div>
      ) : null}
      <p>{`받은 금액(부가세 뺀 값) ${fmt(res.supply)}원 · 같은 범위 시장 기준 보통 ${fmt(res.lo)} ~ ${fmt(res.hi)}원`}</p>
      {res.notes?.length ? (
        <ul className="notes">
          {res.notes.map((n) => <li key={n}>{n}</li>)}
        </ul>
      ) : null}
      {res.why?.length ? (
        <ul className="notes">
          {res.why.map((n) => <li key={n}>{n}</li>)}
        </ul>
      ) : null}
      {res.vat_unknown ? <p className="muted">부가세 말이 없으면 부가세 별도 금액으로 보고 비교했어요.</p> : null}
    </div>
  );
}
