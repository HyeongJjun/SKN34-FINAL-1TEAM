"use client";
// 첫 화면 '내 인테리어': 저장된 건마다 카드 하나 (v1 내 공사 목록 모양). 이어서 하기 · 견적서 · 공정표 · 이름 바꾸기 · 지우기.
// 금액 · 날짜는 서버가 저장할 때 계산해 둔 값을 보여 주기만 한다.
import { useEffect, useState } from "react";
import { errorText } from "@/lib/backend/client";
import { type CaseItem, deleteCase, flush, listCases, renameCase } from "../cases";
import { STEPS, STYLES } from "../data";
import { approxMan, manRange, mdw } from "../doc/shared";
import { goChat } from "../V2App";

const savedDay = (iso: string) => new Date(iso).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric" });

function Progress({ far }: { far: number }) {
  const now = Math.min(Math.max(far, 0), STEPS.length - 1);
  return (
    <div className="mc-prog" aria-label={`진행: ${STEPS[now][1]} 단계까지`}>
      <ol aria-hidden="true">
        {STEPS.map(([id], i) => <li key={id} className={i <= now ? "on" : ""} />)}
      </ol>
      <span>{`${STEPS[now][1]} 단계까지`}</span>
    </div>
  );
}

function CaseCard({ c, onChange }: { c: CaseItem; onChange: () => void }) {
  const [mode, setMode] = useState<"" | "rename" | "delete">("");
  const [title, setTitle] = useState(c.title);
  const [err, setErr] = useState("");
  const st = STYLES.find((s) => s.id === c.style);
  const meta = [st?.ko, c.pyeong ? `${c.pyeong}평` : null, c.region || null, c.picks ? `자재 ${c.picks}개` : null].filter(Boolean).join(" · ");
  const cost = c.cost_lo == null || c.cost_hi == null ? null : c.cost_lo === c.cost_hi ? approxMan(c.cost_lo) : manRange(c.cost_lo, c.cost_hi);
  const run = async (f: () => Promise<unknown>) => {
    setErr("");
    try {
      await f();
      setMode("");
      onChange();
    } catch (e) {
      setErr(errorText(e));
    }
  };
  return (
    <li className="mc-card">
      <div className="mc-top">
        {mode === "rename" ? (
          <form
            className="mc-rename"
            onSubmit={(e) => {
              e.preventDefault();
              if (title.trim()) void run(() => renameCase(c.id, title.trim()));
            }}
          >
            <input className="inp" value={title} maxLength={40} aria-label="인테리어 이름" autoFocus onChange={(e) => setTitle(e.target.value)} />
            <button type="submit" className="btn btn-sm btn-pri" disabled={!title.trim()}>저장</button>
            <button type="button" className="btn btn-sm" onClick={() => (setMode(""), setTitle(c.title))}>취소</button>
          </form>
        ) : (
          <h3>{c.title}</h3>
        )}
        <small className="muted">{`${savedDay(c.updated_at)} 저장`}</small>
      </div>
      {meta ? <p className="muted mc-meta">{meta}</p> : null}
      <dl className="mc-facts">
        <div>
          <dt>예상 공사비</dt>
          <dd>{cost ? <><b className="num">{cost}</b><small>{` 부가세 포함 · ${c.trades}개 공정`}</small></> : <span className="muted">견적서 전이에요</span>}</dd>
        </div>
        <div>
          <dt>공사 기간</dt>
          <dd>
            {c.plan_start && c.plan_end ? (
              <><b>{`${mdw(c.plan_start)} ~ ${mdw(c.plan_end)}`}</b><small>{` 일하는 날 ${c.work_days ?? 0}일`}</small></>
            ) : (
              <span className="muted">공정표 전이에요</span>
            )}
          </dd>
        </div>
      </dl>
      <Progress far={c.far} />
      {mode === "delete" ? (
        <div className="mc-del" role="alert">
          <span>이 인테리어를 지울까요? 되돌릴 수 없어요.</span>
          <button type="button" className="btn btn-sm mc-danger" onClick={() => void run(() => deleteCase(c.id))}>지우기</button>
          <button type="button" className="btn btn-sm" onClick={() => setMode("")}>취소</button>
        </div>
      ) : (
        <div className="mc-acts">
          <a className="btn btn-pri btn-sm" href="#chat" onClick={() => goChat("resume", { caseId: c.id })}>이어서 하기</a>
          {c.quote_total != null ? (
            <a className="btn btn-sm" href="#chat" onClick={() => goChat("resume", { caseId: c.id, open: "quote" })}>견적서</a>
          ) : null}
          {c.plan_start ? (
            <a className="btn btn-sm" href="#chat" onClick={() => goChat("resume", { caseId: c.id, open: "plan" })}>공정표</a>
          ) : null}
          <span className="mc-more">
            <button type="button" className="btn-text gray" onClick={() => setMode("rename")}>이름 바꾸기</button>
            <button type="button" className="btn-text gray" onClick={() => setMode("delete")}>지우기</button>
          </span>
        </div>
      )}
      {err ? <p className="mc-err" role="alert">{err}</p> : null}
    </li>
  );
}

export function MyCases() {
  const [list, setList] = useState<CaseItem[] | null>(null);
  const [err, setErr] = useState("");
  const load = () => {
    flush() // 상담에서 막 돌아왔으면 남은 저장부터
      .then(listCases)
      .then((v) => (setList(v), setErr("")))
      .catch((e) => setErr(errorText(e)));
  };
  useEffect(load, []);
  if (err) return <section className="home-sec mc"><p className="muted">{`내 인테리어를 불러오지 못했어요. ${err}`}</p></section>;
  if (!list?.length) return null;
  return (
    <section className="home-sec mc" aria-labelledby="mc-t">
      <div className="sec-t mc-head">
        <div>
          <h2 id="mc-t">
            내 인테리어<small className="num">{`${list.length}건`}</small>
          </h2>
          <p className="muted">한 건마다 고른 자재 · 견적서 · 공정표가 따로 남아요.</p>
        </div>
        <a className="btn btn-sm" href="#chat" onClick={() => goChat("new")}>+ 새 인테리어</a>
      </div>
      <ul className="mc-list">{list.map((c) => <CaseCard key={c.id} c={c} onChange={load} />)}</ul>
    </section>
  );
}
