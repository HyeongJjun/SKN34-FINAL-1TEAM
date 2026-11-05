// 견적서 파일 작은 그림 (시안 WCompare .thumb). 사진은 파일 그대로, PDF · 엑셀은 모양 아이콘. 뜻은 옆 글자가 알린다.
import { canThumb, kindOf, type QFile } from "./text";
import s from "./Compare.module.css";

const Pdf = () => (
  <svg width="56" height="71" viewBox="0 0 104 132" fill="none" aria-hidden="true">
    <path d="M14 8h56l20 20v96H14z" fill="var(--bg)" stroke="var(--line-paper)" strokeLinejoin="round" />
    <path d="M70 8v20h20z" fill="var(--surface-2)" stroke="var(--line-paper)" strokeLinejoin="round" />
    <path d="M24 22h30" stroke="var(--line-strong)" strokeWidth="5" />
    <path d="M24 36h56M24 44h44" stroke="var(--line)" strokeWidth="3" />
    <path d="M24 56h56v40H24zM24 66h56M24 76h56M24 86h56M58 56v40" stroke="var(--line)" strokeWidth="1.5" />
    <path d="M52 108h28" stroke="var(--line-strong)" strokeWidth="5" />
  </svg>
);

const Sheet = () => (
  <svg width="56" height="71" viewBox="0 0 104 132" fill="none" aria-hidden="true">
    <rect x="10.5" y="10.5" width="83" height="111" fill="var(--bg)" stroke="var(--line-paper)" />
    <rect x="11" y="11" width="82" height="13" fill="var(--accent-weak)" />
    <rect x="11" y="24" width="16" height="97" fill="var(--surface-2)" />
    <path d="M27 11v110M51 11v110M73 11v110M11 24h82M11 36h82M11 48h82M11 60h82M11 72h82M11 84h82M11 96h82M11 108h82" stroke="var(--line)" />
    <rect x="73.5" y="96.5" width="19" height="11" fill="var(--accent-pastel)" />
  </svg>
);

const Paper = () => (
  <svg width="56" height="71" viewBox="0 0 80 104" fill="none" aria-hidden="true">
    <rect width="80" height="104" fill="var(--line)" />
    <g transform="rotate(-5 40 52)">
      <rect x="14" y="12" width="52" height="80" fill="var(--bg)" />
      <path d="M21 22h24" stroke="var(--line-strong)" strokeWidth="4" />
      <path d="M21 33h38M21 40h32M21 50h38M21 57h38M21 64h38M21 71h30" stroke="var(--line-paper)" strokeWidth="2" />
      <path d="M41 82h18" stroke="var(--line-strong)" strokeWidth="4" />
    </g>
  </svg>
);

export function Thumb({ f, href }: { f: QFile; href: string }) {
  const k = kindOf(f.content_type);
  return (
    <span className={s.thumb} aria-hidden="true">
      {k === "photo" && canThumb(f.content_type)
        ? <img className={s.pic} src={href} alt="" loading="lazy" width={56} height={71} />
        : k === "sheet" ? <Sheet /> : k === "photo" ? <Paper /> : <Pdf />}
    </span>
  );
}
