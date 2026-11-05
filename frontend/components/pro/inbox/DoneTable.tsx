"use client";
// 끝남 표. 처음 한 쪽은 서버가 읽어 넘기고, '끝난 일 더 보기'는 next_before 커서로 이어 받아 아래에 붙인다.
// 닫힌 요청과 고객이 확인해 끝난 공사(deal_id)가 끝난 때 최근 순으로 섞여 온다. 새로 붙은 첫 줄로 초점을 옮긴다.
import { useRef, useState } from "react";
import { call, errorText, type Schemas } from "@/lib/backend/client";
import { Who, End } from "./Cells";
import { PAGE, dayOf, pyeongText, type Row } from "./text";
import s from "./inbox.module.css";

type Page = Schemas["InboxPageOut"];

/** 줄 이름: 끝난 공사는 확정 id, 닫힌 요청은 요청 id */
const keyOf = (v: Row) => v.deal_id ?? v.id;

export function DoneTable({ items: first, next: firstNext, total }: { items: Row[]; next: string | null; total: number }) {
  const [items, setItems] = useState(first);
  const [next, setNext] = useState(firstNext);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const focusAt = useRef<string | null>(null);
  const left = Math.max(total - items.length, 0);

  async function more() {
    if (!next || busy) return;
    setBusy(true);
    setErr("");
    try {
      const got = await call<Page>("GET", `/vendor/visits?tab=done&before=${encodeURIComponent(next)}`);
      const seen = new Set(items.map(keyOf));
      const add = got.items.filter((x) => !seen.has(keyOf(x)));
      focusAt.current = add[0] ? keyOf(add[0]) : null;
      setItems([...items, ...add]);
      setNext(got.next_before);
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="mj-table-box" role="region" tabIndex={0} aria-label="끝남 표, 옆으로 넘겨 볼 수 있어요">
        <table className={`mj-table ${s.dense} ${s.cards}`}>
          <caption className="mj-sr">끝난 일 {total}건 중 최근 {items.length}건</caption>
          <thead><tr>
            <th scope="col" className={s.cx}>받은 날</th>
            <th scope="col">고객</th>
            <th scope="col" className={s.cx}>지역</th>
            <th scope="col" className="r">평형</th>
            <th scope="col">어떻게 끝났나</th>
          </tr></thead>
          <tbody>
            {items.map((v) => (
              <tr key={keyOf(v)}>
                <td className={`mj-num ${s.cx} ${s.day}`}>{dayOf(v.received_at)}</td>
                <th scope="row" tabIndex={-1} ref={(el) => { if (el && focusAt.current === keyOf(v)) { focusAt.current = null; el.focus(); } }}>
                  {/* 끝난 공사인데 고객이 연락처를 보내지 않았으면 요청 번호, 그 밖에 연락처가 없으면 '가려졌어요' */}
                  <Who v={v} closed={!(v.deal_id && !v.share_contact)} />
                </th>
                <td className={s.cx}>{v.region}</td>
                <td className="r mj-num">{pyeongText(v.pyeong)}</td>
                <td><End v={v} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {next ? (
        <div>
          <button type="button" className="mj-btn mj-btn-sec mj-btn-sm" onClick={() => void more()} disabled={busy}>
            {busy ? "불러오는 중이에요" : left ? `끝난 일 ${Math.min(left, PAGE)}건 더 보기` : "끝난 일 더 보기"}
          </button>
        </div>
      ) : null}
      {err ? <p role="alert" className="mj-error">{err}</p> : null}
    </>
  );
}
