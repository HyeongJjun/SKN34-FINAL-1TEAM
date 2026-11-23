"use client";
// 표준견적서 쉽게 보기: 총 금액 → 계산 과정(합계 칸) → 포함되지 않은 것 → 공정별 금액 → 확인할 것 → 용어.
// 숫자는 모두 POST /v2/quote-sheet(계산 엔진) 응답을 보이기만 한다. 공급가 · 부가세를 나눠 보이는 곳은 계산 과정 칸 하나다.
import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import type { components } from "@/lib/backend/schema";
import { errorText } from "@/lib/backend/client";
import { numText, won, wonFull } from "@/lib/format";
import { lineStateLabel } from "@/lib/labels";
import { v2Post } from "../api";
import { readSheetInput } from "./input";
import s from "./SheetPage.module.css";

type Sheet = components["schemas"]["V2SheetOut"];
type Trade = Sheet["trades"][number];

const BUCKET = { material: "자재비", labor: "시공비", expense: "경비" } as const;
const pct = (n: number) => `${n.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%`;
const rateText = (r: number) => r.toLocaleString("ko-KR", { style: "percent", maximumFractionDigits: 2 });

const GLOSSARY: [string, string][] = [
  ["순공사비", "자재비 + 시공비 + 경비를 더한 공사 자체 비용"],
  ["공과잡비", "현장 소모품 · 공구 같은 자잘한 비용"],
  ["단수", "끝자리를 맞추려고 버린 금액"],
  ["실측 후", "업체가 집을 재 보고 정하는 줄 (합계 밖)"],
  ["초배지", "벽지 밑에 먼저 바르는 종이"],
  ["몰딩 / 걸레받이", "천장 · 벽 / 바닥 · 벽 사이 테두리"],
  ["문선", "문틀 둘레를 감싸는 마감재"],
  ["M/D (품)", "기능공 1명이 하루에 하는 일"],
];

export function SheetPage() {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [err, setErr] = useState("");
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    const body = readSheetInput();
    if (!body) {
      setEmpty(true);
      return;
    }
    v2Post<Sheet>("quote-sheet", body).then(setSheet, (e) => setErr(errorText(e)));
  }, []);

  if (empty || err) {
    return (
      <main id="main" className={s.wrap}>
        <h1 className={s.h1}>표준견적서 쉽게 보기</h1>
        <p className={s.lead}>{err || "상담에서 견적서를 먼저 만들어 주세요."}</p>
        <Link className="mj-btn mj-btn-pri" href="/v2">상담으로 가기</Link>
      </main>
    );
  }
  if (!sheet) {
    return (
      <main id="main" className={s.wrap}>
        <p className={s.lead} role="status">견적서를 계산하는 중이에요…</p>
      </main>
    );
  }
  return <SheetView q={sheet} />;
}

/** 견본 페이지(/standard-sample)도 같이 쓴다. top: 제목 위에 둘 것(견본 고르기), back: 맨 아래 버튼 */
export function SheetView({ q, top, back = { href: "/v2", label: "상담으로 돌아가기" } }: { q: Sheet; top?: ReactNode; back?: { href: string; label: string } }) {
  const outside = [
    ...new Set(q.trades.flatMap((t) => t.lines.filter((l) => !l.counted).map((l) => l.name))),
  ];
  const sorted = [...q.trades].sort((a, b) => b.total - a.total);
  const days = q.trades.map((t) => `${t.ko} ${numText(t.days)}일`).join(" · ");
  const rates = q.overheads.map((o) => `${o.name} ${rateText(o.rate)}`).join(" · ");

  return (
    <main id="main" className={s.wrap}>
      {top}
      <h1 className={s.h1}>{numText(q.pyeong)}평 아파트 표준견적서, 쉽게 보기</h1>

      <section className={s.hero} aria-label="총 금액">
        <p className={s.heroLab}>총 금액 (부가세 포함)</p>
        <p className={`mj-num ${s.big}`}>{won(q.total)}</p>
        <div className={s.facts}>
          <p className={s.fact}>평당 약 {won(q.per_pyeong)}</p>
          <p className={s.fact}>작업 {days}</p>
          <p className={s.fact}>견적 번호 <span className={s.code}>{q.code}</span></p>
        </div>
        <p className={s.heroNote}>공공 기준으로 계산한 참고 금액이에요. 업체 견적이 아니에요.</p>
      </section>

      <h2 className={s.h2}>{won(q.total)}은 이렇게 계산했어요</h2>
      <div className={`mj-num ${s.calc}`}>
        <Row t="① 순공사비" sub={`자재비 ${pct(q.mix.material)} · 시공비 ${pct(q.mix.labor)}${q.expense ? ` · 경비 ${pct(q.mix.expense)}` : ""}`} n={wonFull(q.net)} />
        {q.overheads.map((o, i) => (
          <Row key={o.key} t={`${"②③④⑤"[i] ?? "·"} ${o.name} (+${rateText(o.rate)})`} n={`+ ${wonFull(o.amount)}`} />
        ))}
        {q.cut ? <Row t="⑥ 단수 (만 원 아래 버림)" n={`− ${wonFull(-q.cut)}`} /> : null}
        <Row t="합계 금액 (부가세 별도)" n={wonFull(q.supply)} cls={s.total} />
        <Row t="부가세 10%" n={`+ ${wonFull(q.vat)}`} />
        <Row t="총 금액 (부가세 포함)" n={wonFull(q.total)} cls={s.final} />
      </div>

      <h2 className={s.h2}>이 금액에 포함되지 않은 것</h2>
      <ul className={s.chips}>
        {outside.map((n) => (
          <li key={n} className={s.chip}>{n}</li>
        ))}
        {q.missing.map((n) => (
          <li key={n} className={s.chip}>{n} 공정</li>
        ))}
        <li className={s.chip}>바닥 · 욕실 · 전기 공정</li>
      </ul>

      <h2 className={s.h2}>
        어디에 돈이 들까? <span className={s.hint}>공정을 누르면 줄마다 보여요</span>
      </h2>
      <div className={s.steps}>
        {sorted.map((t, i) => (
          <TradeRow key={t.trade} t={t} n={i + 1} />
        ))}
      </div>

      <h2 className={s.h2}>업체 견적과 비교할 때 확인할 것</h2>
      <ol className={s.check}>
        <li><span className={s.ic} aria-hidden="true">1</span>공공 기준 단가로 계산한 참고 금액이에요. 실제 업체 견적과 다를 수 있어요.</li>
        <li><span className={s.ic} aria-hidden="true">2</span>순공사비에 {rates}를 붙였어요. 업체마다 요율이 달라요.</li>
        <li><span className={s.ic} aria-hidden="true">3</span>&lsquo;실측 후&rsquo; 줄(철거 · 폐기물 등)은 합계에 없어요. 업체가 실측하고 정해요.</li>
        <li><span className={s.ic} aria-hidden="true">4</span>시공비는 공공 일위대가 단가라 풀 같은 작은 재료가 들어 있어요.</li>
        <li><span className={s.ic} aria-hidden="true">5</span>수량은 평형 · 도면으로 어림했어요. 실측 때 다시 재요.</li>
      </ol>

      <h2 className={s.h2}>용어 사전</h2>
      <dl className={s.glossary}>
        {GLOSSARY.map(([t, d]) => (
          <div key={t}>
            <dt>{t}</dt>
            <dd>{d}</dd>
          </div>
        ))}
      </dl>

      <p className={s.back}>
        <Link className="mj-btn" href={back.href}>{back.label}</Link>
      </p>
    </main>
  );
}

function Row({ t, sub, n, cls }: { t: string; sub?: string; n: string; cls?: string }) {
  return (
    <div className={`${s.row} ${cls ?? ""}`}>
      <div>
        {t}
        {sub ? <span className={s.rowSub}>{sub}</span> : null}
      </div>
      <div className={s.n}>{n}</div>
    </div>
  );
}

function TradeRow({ t, n }: { t: Trade; n: number }) {
  return (
    <details className={s.step}>
      <summary>
        <span className={s.num}>{n}</span>
        <span className={s.name}>{t.ko}</span>
        <span className={s.track} aria-hidden="true">
          <span className={s.fill} style={{ width: `${t.bar}%` }} />
        </span>
        <span className={`mj-num ${s.amt}`}>
          {won(t.total)}
          <span className={s.pct}>{pct(t.share)}</span>
        </span>
        <span className={s.chev} aria-hidden="true">›</span>
      </summary>
      <div className={s.body}>
        <p className={`mj-num ${s.split}`}>
          자재비 {wonFull(t.material)} · 시공비 {wonFull(t.labor)}
          {t.expense ? ` · 경비 ${wonFull(t.expense)}` : ""}
        </p>
        <div className={s.tblBox} role="region" tabIndex={0} aria-label={`${t.ko} 줄, 옆으로 넘겨 볼 수 있어요`}>
          <table className={`mj-num ${s.tbl}`}>
            <caption className="mj-sr">{t.ko} 줄마다 비용 종류 · 수량 · 금액</caption>
            <thead>
              <tr>
                <th scope="col">줄</th>
                <th scope="col">종류</th>
                <th scope="col" className={s.r}>수량</th>
                <th scope="col" className={s.r}>금액(원)</th>
              </tr>
            </thead>
            <tbody>
              {t.lines.map((l) => (
                <tr key={l.key} className={l.counted ? undefined : s.off}>
                  <th scope="row">
                    {l.name}
                    {l.counted ? null : <span className={s.tag}>{lineStateLabel(l.state)}</span>}
                  </th>
                  <td>{BUCKET[l.bucket]}</td>
                  <td className={s.r}>{l.qty != null ? `${numText(l.qty)}${l.unit}` : "—"}</td>
                  <td className={s.r}>{l.amount == null ? "—" : l.counted ? numText(l.amount) : `(${numText(l.amount)})`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  );
}
