"use client";
// 업체 자세히 오른쪽 창 틀 (시안 WVendorsPanel). 위: 이전 · 다음 업체 · 크게 보기 · 닫기, 가운데: 내용(서버가 그림), 아래: 담기.
// 닫기(X) · Esc로 닫는다. 목록에서 열었으면 뒤로 가기와 같고, 아니면 목록 주소로 간다.
// 이전 · 다음은 주소를 바꿔 끼워서(replace) 뒤로 가기 한 번이면 목록으로 돌아간다. 폰(720px 아래)에서는 화면 전체 창이다.
import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Close } from "./icons";
import { takeFromList } from "./pick";
import s from "./VendorPanel.module.css";

type Props = {
  vendorId: string;
  titleId: string;
  listHref: string;
  fullHref: string;
  prevHref: string | null;
  nextHref: string | null;
  pos: number;
  total: number;
  foot: ReactNode;
  children: ReactNode;
};

const Arrow = ({ left }: { left?: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d={left ? "M8.5 3L4.5 7l4 4" : "M5.5 3l4 4-4 4"} /></svg>
);

export function VendorPanel({ vendorId, titleId, listHref, fullHref, prevHref, nextHref, pos, total, foot, children }: Props) {
  const router = useRouter();

  function close() {
    if (takeFromList(listHref)) router.back();
    else router.replace(listHref, { scroll: false });
  }

  // 창이 열리거나 다른 업체로 넘기면 창 제목으로 옮겨 간다
  useEffect(() => { document.getElementById(titleId)?.focus(); }, [vendorId, titleId]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || document.querySelector("dialog[open]")) return;
      close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <aside className={s.vd} aria-labelledby={titleId} data-vendor-panel="">
      <div className={s.bar}>
        <div className={s.nav}>
          {prevHref ? <Link className="mj-btn mj-btn-sec mj-btn-sm" href={prevHref} replace scroll={false}><Arrow left />이전<span className={s.wide}> 업체</span></Link> : <span className="mj-btn mj-btn-sec mj-btn-sm" aria-disabled="true"><Arrow left />이전<span className={s.wide}> 업체</span></span>}
          {nextHref ? <Link className="mj-btn mj-btn-sec mj-btn-sm" href={nextHref} replace scroll={false}>다음<span className={s.wide}> 업체</span><Arrow /></Link> : <span className="mj-btn mj-btn-sec mj-btn-sm" aria-disabled="true">다음<span className={s.wide}> 업체</span><Arrow /></span>}
          {total ? <span className="mj-small mj-num">{pos} / {total}</span> : null}
        </div>
        <div className={s.act}>
          {/* 크게 보기는 같은 주소를 새로 열어 전체 화면으로 본다 */}
          <a className={s.gbtn} href={fullHref}>크게 보기</a>
          <button type="button" className={s.x} aria-label="업체 자세히 창 닫기" onClick={close}><Close /></button>
        </div>
      </div>
      <div className={s.body}>{children}</div>
      <div className={s.foot}>{foot}</div>
    </aside>
  );
}
