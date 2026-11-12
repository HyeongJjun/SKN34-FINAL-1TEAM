"use client";
// 자주 묻는 질문: 질문을 누르면 정해진 답이 이 자리에서 펼쳐져요(근거 자료에 있는 말만).
import { useState } from "react";
import { FAQ_GROUPS, type FaqItem } from "./faqData";
import { startWithTool } from "./start";

const Chevron = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function Answer({ it }: { it: FaqItem }) {
  return (
    <div className="fq-a">
      <p>
        {it.body.map((b, i) => (typeof b === "number" ? <sup key={i}>{`[${b}]`}</sup> : <span key={i}>{b}</span>))}
      </p>
      {it.noBasis ? <p className="fq-nb">{`자료로 확인하지 못한 것: ${it.noBasis}. 직접 물어보세요.`}</p> : null}
      {it.ask ? (
        <div className="fq-ask">
          <small>{`${it.ask.to}에 물어볼 문장`}</small>
          <q>{it.ask.text}</q>
        </div>
      ) : null}
      <ol className="fq-refs" aria-label="근거">
        {it.refs.map((r, i) => (
          <li key={i}>
            <span>{`[${i + 1}] `}</span>
            {r.url ? (
              <a href={r.url} target="_blank" rel="noopener noreferrer">{r.src}</a>
            ) : (
              r.src
            )}
            <small>{` · ${r.pub}${r.date ? ` · ${r.date}` : ""}`}</small>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function FaqSection() {
  const [group, setGroup] = useState("all");
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const toggle = (id: string) =>
    setOpen((o) => {
      const n = new Set(o);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const groups = FAQ_GROUPS.filter((g) => group === "all" || g.id === group);
  return (
    <section className="home-sec fq">
      <div className="sec-t">
        <h2>자주 묻는 질문</h2>
        <p className="muted">질문을 누르면 답과 근거 자료가 바로 보여요.</p>
      </div>
      <div className="chips fq-tabs" role="group" aria-label="질문 분류">
        {[["all", "전체"] as const, ...FAQ_GROUPS.map((g) => [g.id, g.title] as const)].map(([id, ko]) => (
          <button key={id} type="button" className="chip" aria-pressed={group === id} onClick={() => setGroup(id)}>
            {ko}
          </button>
        ))}
      </div>
      <div className="fq-list">
        {groups.map((g) => (
          <div key={g.id} className="fq-group">
            {group === "all" ? <h3>{g.title}</h3> : null}
            {g.items.map((it) => {
              const on = open.has(it.id);
              return (
                <div key={it.id} className="fq-item" data-open={on || undefined}>
                  <h4>
                    <button type="button" className="fq-q" aria-expanded={on} aria-controls={`${it.id}-a`} id={`${it.id}-q`} onClick={() => toggle(it.id)}>
                      <span>{it.q}</span>
                      <Chevron />
                    </button>
                  </h4>
                  <div id={`${it.id}-a`} role="region" aria-labelledby={`${it.id}-q`} hidden={!on}>
                    <Answer it={it} />
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="row">
        <button type="button" className="btn btn-sm" onClick={() => startWithTool("calc")}>셀프 계산기</button>
        <button type="button" className="btn btn-sm" onClick={() => startWithTool("check")}>체크리스트</button>
        <button type="button" className="btn btn-sm" onClick={() => startWithTool("compare")}>받은 견적 맞춰 보기</button>
      </div>
    </section>
  );
}
