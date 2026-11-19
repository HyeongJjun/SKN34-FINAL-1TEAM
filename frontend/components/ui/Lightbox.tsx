"use client";
// 크게 보기(design-system 3.3 Lightbox · 9판 C47 photo_view): 시공 사례 · 리뷰 · 집 사진을 한 장씩 크게.
//   폰(< 768): 화면 전체 어두운 바탕 · 손가락으로 옆으로 넘김(스크롤 맞춤) · 위 '× 닫기' + '시공 사례 1 / 6' · 아래 설명 · 점 · ‹ › 단추.
//             뒤로 가기로 닫혀요(기록 한 칸).
//   웹(≥ 768): 가운데 760 · 사진 양옆 ‹ › · 키보드 ← → · Home · End · Esc · 바깥 누르기로 닫아요.
// 넘김만으로 옮기지 않게 늘 ‹ › 단추도 있어요(WCAG 2.5.1). 바뀌면 '시공 사례 2 / 6, 거실 · 실크벽지'를 읽어 줘요.
// 사진 위에 글자를 얹지 않고(설명은 사진 아래), 사진 주소는 같은 사이트(/api/files/…)만 써요.
import { useEffect, useEffectEvent, useId, useRef, useState, type KeyboardEvent } from "react";
import { MQ } from "@/components/site/breakpoints";
import { Icon } from "./Icon";
import { useModal } from "./useModal";
import s from "./Lightbox.module.css";

export type LightboxPhoto = { key: string; src: string; alt: string; /** 사진 아래 굵은 줄('거실 · 실크벽지') */ title?: string; /** 그 아래 작은 줄('공급 79.3㎡ · 2026년 10월 · 마루와벽') */ sub?: string };

const isPhone = () => !window.matchMedia(MQ.tablet).matches;
const calm = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function Lightbox({ open, onClose, photos, start = 0, label = "사진", onIndex, pushHistory = true }: {
  open: boolean;
  onClose: () => void;
  photos: LightboxPhoto[];
  /** 처음 보일 사진(사진 칸에서 누른 것) */
  start?: number;
  /** 머리 이름: '시공 사례' · '리뷰 사진' → '시공 사례 1 / 6' */
  label?: string;
  /** 지금 사진이 바뀔 때(주소에 ?photo= 를 남길 때 등) */
  onIndex?: (i: number) => void;
  /** 폰에서 열 때 기록 한 칸을 넣어 뒤로 가기로 닫아요. 주소(?photo=)로 이미 기록이 생기면 false */
  pushHistory?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const id = useId();
  const n = photos.length;
  const clamp = (k: number) => Math.min(Math.max(k, 0), Math.max(n - 1, 0));
  const [i, setI] = useState(() => clamp(start));
  const [said, setSaid] = useState("");
  const now = useRef(i); // 지금 사진(스크롤 · 단추 · 키가 모두 이 값 하나를 봐요)
  const aim = useRef<number | null>(null); // 단추 · 키로 넘기는 중인 사진(그동안 스크롤로 번호를 바꾸지 않아요)
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const release = useRef<ReturnType<typeof setTimeout> | null>(null);
  const h = useModal(ref, open, onClose, { closeOnBack: () => pushHistory && isPhone() });

  /** 사진 바꾸기. how: open 열 때(움직임 없이 자리만) · move 단추 · 키(그 사진으로 넘김) · swipe 손가락으로 넘긴 뒤(넘기지 않음) */
  const show = (k: number, how: "open" | "move" | "swipe") => {
    const next = clamp(k);
    if (how !== "open" && next === now.current) return;
    now.current = next;
    setI(next);
    if (how === "open") setSaid("");
    else {
      onIndex?.(next);
      const p = photos[next];
      setSaid(`${label} ${next + 1} / ${n}${p?.title ? `, ${p.title}` : ""}`);
    }
    const t = track.current;
    if (!t || how === "swipe") return;
    const left = next * t.clientWidth;
    const instant = how === "open" || calm() || document.hidden;
    aim.current = instant ? null : next;
    if (release.current) clearTimeout(release.current);
    if (!instant) release.current = setTimeout(() => { aim.current = null; }, 1500); // 넘김이 끊겨도 번호 맞추기가 멈추지 않게
    if (instant) t.scrollLeft = left;
    else t.scrollTo({ left, behavior: "smooth" });
  };

  // 열 때마다 누른 사진부터. useModal이 먼저 showModal()을 불러 칸 너비가 잡혀 있어요
  const openAt = useEffectEvent(() => show(start, "open"));
  useEffect(() => {
    if (open) openAt();
    return () => { if (settle.current) clearTimeout(settle.current); if (release.current) clearTimeout(release.current); };
  }, [open, start]);

  const go = (k: number) => show(k, "move");

  const onScroll = () => {
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      const t = track.current;
      if (!t || !t.clientWidth) return;
      const k = clamp(Math.round(t.scrollLeft / t.clientWidth));
      if (aim.current !== null) { if (k === aim.current) aim.current = null; return; }
      show(k, "swipe");
    }, 120);
  };
  // 손가락이 닿으면 넘기는 중이던 것은 손가락에 맡겨요
  const onTouch = () => { aim.current = null; };

  const onKey = (e: KeyboardEvent<HTMLDialogElement>) => {
    if (e.key === "ArrowRight") { e.preventDefault(); go(now.current + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(now.current - 1); }
    else if (e.key === "Home") { e.preventDefault(); go(0); }
    else if (e.key === "End") { e.preventDefault(); go(n - 1); }
  };

  const cur = photos[i];
  return (
    <dialog ref={ref} className={s.box} aria-labelledby={`${id}-t`} onCancel={h.onCancel} onClick={h.onClick} onKeyDown={onKey}>
      {open && cur ? (
        <div className={s.frame}>
          <div className={s.head}>
            <button type="button" className={s.x} aria-label="닫기" onClick={onClose}><Icon name="close" /></button>
            <h2 id={`${id}-t`} className={s.title}>{label} <span className={s.num}>{i + 1} / {n}</span></h2>
          </div>
          <div className={s.stage}>
            <button type="button" className={`${s.nav} ${s.side} ${s.prev}`} aria-label="이전 사진" disabled={i === 0} onClick={() => go(now.current - 1)}><Icon name="chevron-left" size={28} /></button>
            <div ref={track} className={s.track} onScroll={onScroll} onPointerDown={onTouch} onTouchStart={onTouch}>
              {photos.map((p, k) => (
                <figure key={p.key} className={s.slide} aria-hidden={k !== i || undefined}>
                  {/* 가까운 사진만 먼저 받아요 */}
                  <img className={s.img} src={p.src} alt={p.alt} loading={Math.abs(k - i) <= 1 ? "eager" : "lazy"} decoding="async" draggable={false} />
                </figure>
              ))}
            </div>
            <button type="button" className={`${s.nav} ${s.side} ${s.next}`} aria-label="다음 사진" disabled={i === n - 1} onClick={() => go(now.current + 1)}><Icon name="chevron-right" size={28} /></button>
          </div>
          <div className={s.cap}>
            {cur.title ? <b className={s.capTitle}>{cur.title}</b> : null}
            {cur.sub ? <span className={s.capSub}>{cur.sub}</span> : null}
            <div className={s.foot}>
              <button type="button" className={`${s.nav} ${s.bottom}`} aria-label="이전 사진" disabled={i === 0} onClick={() => go(now.current - 1)}><Icon name="chevron-left" /></button>
              <div className={s.dots} aria-hidden="true">{photos.map((p, k) => <i key={p.key} className={k === i ? s.on : undefined} />)}</div>
              <button type="button" className={`${s.nav} ${s.bottom}`} aria-label="다음 사진" disabled={i === n - 1} onClick={() => go(now.current + 1)}><Icon name="chevron-right" /></button>
            </div>
          </div>
          <p className="mj-sr" aria-live="polite">{said}</p>
        </div>
      ) : null}
    </dialog>
  );
}
