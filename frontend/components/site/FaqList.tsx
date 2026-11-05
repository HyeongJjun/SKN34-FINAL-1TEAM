"use client";
// 자주 묻는 질문 목록(시안 WGuide). 질문을 누르면 그 자리에서 답이 펼쳐지고, 펼쳐 있던 답은 접혀요.
// 주소 끝에 #q-… 가 붙어 오면(첫 화면 미리 보기) 그 질문을 펼친 채로 보여 줘요.
import { Fragment, useEffect, useState } from "react";
import type { Faq, FaqGroup } from "./faq";
import s from "./FaqList.module.css";

function Answer({ it, open }: { it: Faq; open: boolean }) {
  const refs = it.refs ?? [];
  return (
    <div id={`${it.id}-a`} className={s.ans} hidden={!open}>
      <p className={s.body}>
        {it.body.map((b, i) => typeof b === "number"
          ? <sup key={i}><a href={`#${it.id}-r${b}`} aria-label={`근거 ${b}, 시방서 내용 보기`}>[{b}]</a></sup>
          : <Fragment key={i}>{b}</Fragment>)}
      </p>
      {it.noBasis ? <p className="mj-small">근거 없는 부분: {it.noBasis}</p> : null}
      {it.ask ? (
        <p className={s.ask}><span className="mj-small">업체에 물어볼 문장</span>“{it.ask}”</p>
      ) : null}
      {refs.length ? (
        <div className={s.refs}>
          {refs.map((r, i) => (
            <p key={r.src} id={`${it.id}-r${i + 1}`} className="mj-small"><b className={s.ink}>[{i + 1}] {r.src}</b> {r.quote ? `“${r.text}”` : r.text}</p>
          ))}
        </div>
      ) : null}
      {it.note ? <p className={`mj-small ${s.note}`}>{it.note}</p> : null}
    </div>
  );
}

export function FaqList({ groups, initialOpen }: { groups: FaqGroup[]; initialOpen: string | null }) {
  const [open, setOpen] = useState<string | null>(initialOpen);

  useEffect(() => {
    const ids = new Set(groups.flatMap((g) => g.items.map((it) => it.id)));
    const fromHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1)).replace(/-(a|r\d+)$/, "");
      if (ids.has(id)) setOpen(id);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [groups]);

  return (
    <>
      {groups.map((g) => (
        <section key={g.id} className={s.grp} aria-labelledby={g.id}>
          <h2 id={g.id} className="mj-h2">{g.title}</h2>
          <ul className={s.qs}>
            {g.items.map((it) => {
              const on = open === it.id;
              return (
                <li key={it.id} id={it.id}>
                  <h3 className={s.qh}>
                    <button type="button" className={s.qb} aria-expanded={on} aria-controls={`${it.id}-a`} onClick={() => setOpen(on ? null : it.id)}>
                      <span>{it.q}</span>
                      <span className={s.qt}>
                        <span className="mj-small">{it.tag}</span>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3.5 6l4.5 4.5L12.5 6" /></svg>
                      </span>
                    </button>
                  </h3>
                  <Answer it={it} open={on} />
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}
