"use client";
// 공사 전에 할 일 (시안 WPlanDone · WSchedule '공사 전에 할 일'). 확정 공정표와 한 공사 화면이 같이 쓴다.
// 누르면 PUT /projects/{id}/checks/{key} {done}을 보내고 응답 목록으로 바꾼다. 실패하면 되돌리고 서버 문장을 보인다.
// 체크 글자는 서버가 주는 label 그대로다. 시작일은 API 값을 형식만 바꾼다.
import { useId, useState } from "react";
import { call, errorText, type Schemas } from "@/lib/backend/client";
import { md } from "@/lib/format";
import s from "./PreWorkCheck.module.css";

type Check = Schemas["ProjectCheckOut"];

type Props = {
  projectId: string;
  checks: Check[];
  /** 공사 시작일 (확정 공정표의 시작, 모르면 null) */
  start: string | null;
};

export function PreWorkCheck({ projectId, checks, start }: Props) {
  const uid = useId();
  const [seen, setSeen] = useState(checks);
  const [list, setList] = useState(checks);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<{ key: string; text: string } | null>(null);

  // 화면을 새로 그리면(router.refresh) 새 값으로 바꾼다
  if (seen !== checks) {
    setSeen(checks);
    setList(checks);
  }

  async function toggle(key: string, done: boolean) {
    if (busy) return;
    const before = list;
    setList(list.map((c) => (c.key === key ? { ...c, done } : c)));
    setBusy(key);
    setErr(null);
    try {
      setList(await call<Check[]>("PUT", `/projects/${projectId}/checks/${encodeURIComponent(key)}`, { done }));
    } catch (e) {
      setList(before);
      setErr({ key, text: errorText(e) });
    } finally {
      setBusy(null);
    }
  }

  if (!list.length) return null;
  return (
    <section className={s.box} aria-labelledby={`${uid}-h`}>
      <h2 id={`${uid}-h`} className="mj-h3">공사 전에 할 일</h2>
      <ul className={s.list}>
        {list.map((c) => {
          const hint = `${uid}-${c.key}-h`;
          const bad = err?.key === c.key ? `${uid}-${c.key}-e` : "";
          return (
            <li key={c.key} className={s.item}>
              <label className={s.chk}>
                <input
                  type="checkbox"
                  checked={c.done}
                  aria-describedby={[start ? hint : "", bad].filter(Boolean).join(" ") || undefined}
                  aria-busy={busy === c.key || undefined}
                  onChange={(e) => toggle(c.key, e.currentTarget.checked)}
                />
                <span><b>{c.label}</b></span>
              </label>
              {start ? <p id={hint} className={`mj-hint mj-num ${s.hint}`}>공사 시작 {md(start)} 전에 해 주세요.</p> : null}
              {bad ? <p id={bad} className={`mj-error ${s.hint}`} role="alert">{err?.text}</p> : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
