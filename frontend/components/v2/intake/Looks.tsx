"use client";
// 느낌 사진 모음 겹창 (v10 openLooks · SPACE_FILTERS · inFilter). onPick(lk)를 넘기면 [이 사진으로 할게요] 버튼이 생긴다.
// 크게 보기: 손가락으로 밀면 사진이 따라오고 한 장씩 멈춘다(스크롤 스냅). 마우스는 끌기 · 좌우 버튼 · 아래 작은 사진 · 방향키로 넘긴다.
import { useEffect, useLayoutEffect, useRef, useState, type MutableRefObject } from "react";
import type { Style } from "../data";
import { openOverlay } from "../engine";
import { lookSrcs } from "../flow";
import { type Look, lookOf, lookPhotos, TONE_KO } from "../looks";
import { Photo } from "../photo";
import { useV2 } from "../store";

export const SPACE_FILTERS: [string, string][] = [["all", "전체"], ["living", "거실"], ["kitchen", "주방 · 다이닝"], ["bed", "침실 · 아이방"], ["bath", "욕실"], ["etc", "현관 · 서재 · 옷방"]];
export const inFilter = (lk: Look, f: string) =>
  f === "all" || lk.space === f || (f === "kitchen" && lk.space === "dining") || (f === "bed" && lk.space === "kid") || (f === "etc" && ["entry", "study", "dress"].includes(lk.space));

/** pickLabel: 고르는 버튼 글. 첫 화면은 상담 시작, 상담 안에서는 느낌 고르기 */
type Opts = { start?: string | null; onPick?: (lk: Look) => void; pickLabel?: string };

const Arw = ({ d }: { d: number }) => (
  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
    <path d={d < 0 ? "M16 4l-8 8 8 8" : "M8 4l8 8-8 8"} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const smooth = (): ScrollBehavior => (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");

/** 크게 보기. 지금 보는 사진은 스크롤 자리로 정하고 setCur로 알린다 */
function Viewer({ shown, cur, setCur, nav }: { shown: Look[]; cur: Look; setCur: (l: Look) => void; nav: MutableRefObject<(d: number) => void> }) {
  const track = useRef<HTMLDivElement>(null);
  const thumbs = useRef<HTMLUListElement>(null);
  const idx = Math.max(0, shown.findIndex((v) => v.id === cur.id));
  const target = useRef<number | null>(null); // 버튼 · 작은 사진으로 넘기는 중이면 그 자리
  const settle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const drag = useRef<{ x: number; left: number } | null>(null);
  const waits = useRef(0);

  // 처음 열 때는 고른 사진 자리에서 바로 시작한다
  useLayoutEffect(() => {
    const t = track.current;
    if (t) t.scrollLeft = idx * t.clientWidth;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => () => clearTimeout(settle.current), []);

  const at = () => {
    const t = track.current;
    return t ? Math.round(t.scrollLeft / Math.max(1, t.clientWidth)) : idx;
  };
  const go = (i: number) => {
    const t = track.current;
    if (!t || i < 0 || i >= shown.length) return;
    target.current = i;
    setCur(shown[i]);
    t.scrollTo({ left: i * t.clientWidth, behavior: smooth() });
  };
  nav.current = (d) => go(at() + d);

  // 작은 사진 줄: 지금 사진이 가운데 오게
  useEffect(() => {
    const ul = thumbs.current;
    const li = ul?.children[idx] as HTMLElement | undefined;
    if (ul && li) ul.scrollTo({ left: li.offsetLeft - (ul.clientWidth - li.clientWidth) / 2, behavior: smooth() });
  }, [idx]);

  /** 스크롤이 멈추면: 지금 자리를 따르고, 끌기 동안 꺼 둔 스냅을 다시 켠다 */
  const arm = () => {
    clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      const t = track.current;
      if (!t) return;
      // 끌기를 놓은 뒤 아직 넘어가는 중이면 조금 더 기다리고, 너무 길면 그 자리로 바로 옮긴다
      if (t.classList.contains("drag") && target.current != null && Math.abs(t.scrollLeft - target.current * t.clientWidth) > 2) {
        if (waits.current++ < 6) return arm();
        t.scrollLeft = target.current * t.clientWidth;
      }
      waits.current = 0;
      target.current = null;
      t.classList.remove("drag");
      const j = at();
      if (shown[j]) setCur(shown[j]);
    }, 140);
  };
  const onScroll = () => {
    if (drag.current) return;
    const i = at();
    if (target.current == null && shown[i] && shown[i].id !== cur.id) setCur(shown[i]);
    arm();
  };
  const endDrag = (x: number) => {
    const d = drag.current;
    const t = track.current;
    if (!d || !t) return;
    drag.current = null;
    const dx = x - d.x;
    const base = Math.round(d.left / Math.max(1, t.clientWidth));
    const next = Math.abs(dx) > Math.min(80, t.clientWidth * 0.15) ? base + (dx < 0 ? 1 : -1) : base;
    go(Math.max(0, Math.min(shown.length - 1, next))); // 스냅은 다 넘어간 뒤 arm이 켠다
    arm();
  };

  return (
    <>
      <div className="lk-stage">
        <div
          ref={track}
          className="lk-track"
          onScroll={onScroll}
          onPointerDown={(e) => {
            if (e.pointerType !== "mouse" || e.button !== 0 || !track.current) return; // 손가락은 브라우저 스크롤이 맡는다
            drag.current = { x: e.clientX, left: track.current.scrollLeft };
            track.current.setPointerCapture(e.pointerId);
            track.current.classList.add("drag");
          }}
          onPointerMove={(e) => {
            if (drag.current && track.current) track.current.scrollLeft = drag.current.left - (e.clientX - drag.current.x);
          }}
          onPointerUp={(e) => endDrag(e.clientX)}
          onPointerCancel={(e) => endDrag(e.clientX)}
        >
          {shown.map((lk, i) => (
            <div key={lk.id} className="lk-slide" aria-hidden={i !== idx || undefined}>
              <Photo srcs={lookSrcs(lk)} alt={`${lk.ko} ${lk.space_ko}`} cls="lk-big" eager={Math.abs(i - idx) <= 1} />
            </div>
          ))}
        </div>
        <button type="button" className="lk-nav prev" aria-label="이전 사진" disabled={idx === 0} onClick={() => go(idx - 1)}><Arw d={-1} /></button>
        <button type="button" className="lk-nav next" aria-label="다음 사진" disabled={idx >= shown.length - 1} onClick={() => go(idx + 1)}><Arw d={1} /></button>
        <span className="lk-count" aria-live="polite">{`${idx + 1} / ${shown.length}`}</span>
      </div>
      {shown.length > 1 ? (
        <ul ref={thumbs} className="lk-thumbs" aria-label="사진 고르기">
          {shown.map((lk, i) => (
            <li key={lk.id}>
              <button type="button" className="lk-thumb" aria-label={`${i + 1}번째 사진 · ${lk.ko}`} aria-current={i === idx} onClick={() => go(i)}>
                <Photo srcs={lookSrcs(lk)} alt="" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

function LooksSheet({ st, start, onPick, pickLabel = "이 느낌으로 할게요", close }: Opts & { st: Style; close: () => void }) {
  const S = useV2();
  const list = lookPhotos(st.id);
  const [filter, setFilter] = useState("all");
  const [cur, setCur] = useState<Look | null>(() => {
    const first = lookOf(start);
    return first && first.style === st.id && first.img ? first : null;
  });
  const x = useRef<HTMLButtonElement>(null);
  const nav = useRef<(d: number) => void>(() => {});
  const shown = list.filter((l) => inFilter(l, filter));
  const curRef = useRef(cur);
  curRef.current = cur;

  useEffect(() => {
    x.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (curRef.current) setCur(null);
        else close();
      } else if (curRef.current && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
        e.preventDefault();
        nav.current(e.key === "ArrowRight" ? 1 : -1);
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [close]);

  return (
    <div
      className="sheet-bg lk-bg"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="sheet lk-sheet" role="dialog" aria-modal="true" aria-label={`${st.ko} 사진 모음`}>
        <div className="lk-head">
          <h3>{`${st.ko} · ${list.length}가지`}</h3>
          <button ref={x} type="button" className="x" aria-label="닫기" onClick={close}>×</button>
        </div>
        <div className="lk-body">
          {cur ? (
            <>
              <Viewer shown={shown} cur={cur} setCur={setCur} nav={nav} />
              <div className="lk-info">
                <div>
                  <h4>{cur.ko}</h4>
                  <p className="muted">{`${cur.space_ko} · ${cur.note}`}</p>
                </div>
                <ul className="lk-tones" aria-label="이 느낌의 색">
                  {Object.entries(cur.tone).map(([k, c]) => (
                    <li key={k}>
                      <i style={{ background: c }} />
                      {TONE_KO[k]}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <>
              <p className="muted">많이 고르는 순이에요.</p>
              <div className="chips lk-filter" role="group" aria-label="공간">
                {SPACE_FILTERS.filter(([f]) => f === "all" || list.some((l) => inFilter(l, f))).map(([f, ko]) => (
                  <button key={f} type="button" className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
                    {ko}
                  </button>
                ))}
              </div>
              <ul className="lk-grid">
                {shown.map((lk) => (
                  <li key={lk.id}>
                    <button type="button" className="lk-tile" aria-current={S.look === lk.id} onClick={() => setCur(lk)}>
                      <Photo srcs={lookSrcs(lk)} alt={`${lk.ko} ${lk.space_ko}`} cls="lk-ph" />
                      {lk.rank <= 3 ? <span className="lk-rank">{`많이 고름 ${lk.rank}`}</span> : null}
                      <span className="lk-cap">
                        <b>{lk.ko}</b>
                        <small>{lk.space_ko}</small>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        {cur ? (
          <div className="lk-foot">
            <button type="button" className="btn" onClick={() => setCur(null)}>{`전체 ${shown.length}장 보기`}</button>
            {onPick ? (
              <button
                type="button"
                className="btn btn-pri"
                onClick={() => {
                  close();
                  onPick(cur);
                }}
              >
                {pickLabel}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** 느낌 사진 모음(많이 고르는 순)을 연다 */
export function openLooks(st: Style, { start, onPick, pickLabel }: Opts = {}) {
  openOverlay((close) => <LooksSheet st={st} start={start} onPick={onPick} pickLabel={pickLabel} close={close} />);
}
