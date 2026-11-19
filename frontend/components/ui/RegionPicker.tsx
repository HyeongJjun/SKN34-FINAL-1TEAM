"use client";
// 지역 두 칸 목록: 왼쪽 지역(시 · 도), 오른쪽 시 · 군 · 구. 고객 기본 정보(하나, RegionSheet) · 업체 가입 신청(여러 개)이 같이 써요.
// - 목록은 칸 안에서만 스크롤돼요(브라우저 기본 고르기 상자처럼 화면 밖으로 펼쳐지지 않아요).
// - 줄마다 숨긴 라디오 · 체크 상자를 둬서 키보드 · 화면 읽기는 기본 동작 그대로예요. 초점 테두리는 줄 안쪽에 그려 잘리지 않아요.
// - 여러 개(many): 오른쪽 맨 위 '전체', 왼쪽 지역 옆에 고른 수.
import { useEffect, useId, useRef } from "react";
import { Icon } from "./Icon";
import s from "./RegionPicker.module.css";

export type RegionTable = { id: string; name: string; groups: { label?: string; prefix: string; items: string[] }[] }[];
/** 시 · 군 · 구 열쇠 'seoul/노원구'(업체 다니는 지역과 같은 모양) */
export const regionKey = (sido: string, sgg: string) => `${sido}/${sgg}`;

/** 칸 안에서 고른 줄이 가운데쯤 보이게(창 · 페이지는 움직이지 않아요) */
function centerChecked(col: HTMLElement | null) {
  const row = col?.querySelector<HTMLElement>("input:checked")?.closest("label");
  if (col && row) col.scrollTop = row.offsetTop - (col.clientHeight - row.offsetHeight) / 2;
}

export function RegionPicker({ regions, sido, onSido, value, onChange, mode, label, className }: {
  regions: RegionTable;
  sido: string;
  onSido: (id: string) => void;
  /** 고른 열쇠들(하나 고르기는 0 · 1개) */
  value: string[];
  onChange: (keys: string[]) => void;
  mode: "one" | "many";
  /** 묶음 이름(화면 읽기용, 예: '다니는 지역') */
  label: string;
  className?: string;
}) {
  const id = useId();
  const left = useRef<HTMLFieldSetElement>(null);
  const right = useRef<HTMLFieldSetElement>(null);
  const first = useRef(true);

  // 처음 그릴 때는 고른 줄로, 지역을 바꾸면 오른쪽 맨 위로
  useEffect(() => {
    if (first.current) {
      first.current = false;
      const t = requestAnimationFrame(() => { centerChecked(left.current); centerChecked(right.current); });
      return () => cancelAnimationFrame(t);
    }
    if (right.current) right.current.scrollTop = 0;
  }, [sido]);

  const r = regions.find((x) => x.id === sido);
  const many = (r?.groups.length ?? 0) > 1;
  const keys = r ? r.groups.flatMap((g) => g.items.map((it) => regionKey(r.id, it))) : [];
  const picked = new Set(value);
  const count = (rid: string) => value.filter((k) => k.startsWith(`${rid}/`)).length;
  const allOn = keys.length > 0 && keys.every((k) => picked.has(k));
  const someOn = !allOn && keys.some((k) => picked.has(k));

  const toggle = (k: string) => {
    if (mode === "one") { onChange([k]); return; }
    onChange(picked.has(k) ? value.filter((x) => x !== k) : [...value, k]);
  };
  const toggleAll = () => {
    const rest = value.filter((k) => !keys.includes(k));
    onChange(allOn ? rest : [...rest, ...keys]);
  };

  return (
    <div className={[s.picker, className].filter(Boolean).join(" ")} role="group" aria-label={label}>
      <fieldset ref={left} className={`${s.col} ${s.sido}`}>
        <legend className="mj-sr">지역</legend>
        {regions.map((x) => {
          const n = mode === "many" ? count(x.id) : 0;
          return (
            <label key={x.id} className={s.row}>
              <input type="radio" name={`${id}-sido`} value={x.id} checked={x.id === sido} onChange={() => onSido(x.id)}
                aria-label={n ? `${x.name}, ${n}곳 고름` : undefined} />
              <span>{x.name}</span>
              {n ? <b className={`${s.n} mj-num`} aria-hidden="true">{n}</b> : null}
            </label>
          );
        })}
      </fieldset>
      <fieldset ref={right} className={`${s.col} ${s.sgg}`} disabled={!r}>
        <legend className="mj-sr">{r ? `${r.name} 시 · 군 · 구` : "시 · 군 · 구"}</legend>
        {mode === "many" && r ? (
          <label className={`${s.row} ${s.all}`}>
            <input type="checkbox" checked={allOn} ref={(el) => { if (el) el.indeterminate = someOn; }} onChange={toggleAll} aria-label={`${r.name} 전체`} />
            <span>{r.name} 전체</span>
            <Mark on={allOn} part={someOn} />
          </label>
        ) : null}
        {r?.groups.map((g) => (
          <div key={g.prefix || r.id} className={s.group}>
            {many ? <p className={s.gh} aria-hidden="true">{g.label || g.prefix}</p> : null}
            {g.items.map((it) => {
              const k = regionKey(r.id, it);
              const on = picked.has(k);
              const name = many && g.prefix ? `${g.prefix} ${it}` : undefined;
              return (
                <label key={k} className={s.row}>
                  {mode === "one"
                    ? <input type="radio" name={`${id}-sgg`} value={k} checked={on} onChange={() => toggle(k)} aria-label={name} />
                    : <input type="checkbox" value={k} checked={on} onChange={() => toggle(k)} aria-label={name} />}
                  <span>{it}</span>
                  {mode === "one" ? (on ? <Icon name="check" size={18} strokeWidth={2.5} /> : null) : <Mark on={on} />}
                </label>
              );
            })}
          </div>
        ))}
      </fieldset>
    </div>
  );
}

/** 여러 개 고르기 줄 오른쪽 네모(꾸밈, 상태는 숨긴 체크 상자가 알려요) */
function Mark({ on, part }: { on: boolean; part?: boolean }) {
  return (
    <span className={on || part ? `${s.box} ${s.boxOn}` : s.box} aria-hidden="true">
      {on ? <Icon name="check" size={14} strokeWidth={3} /> : part ? <i className={s.dash} /> : null}
    </span>
  );
}
