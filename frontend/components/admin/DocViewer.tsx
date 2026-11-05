"use client";
// 사업자등록증 보기 (시안 WAdmin): 사진이면 배율 · 오른쪽으로 90도 돌리기, PDF면 '새 탭에서 열기'.
// 파일은 /api/files/{id}로 읽는다(올린 업체와 관리자만 볼 수 있다).
import { useEffect, useRef, useState } from "react";
import type { Schemas } from "@/lib/backend/client";
import { fileSize, stampSeoul } from "@/lib/format";
import s from "./DocViewer.module.css";

type License = Schemas["LicenseOut"];
const ZOOMS = [50, 75, 100, 125, 150, 200, 300];

export function DocViewer({ fileId, file, changedFrom }: { fileId: string; file: License | null; changedFrom?: string | null }) {
  const src = `/api/files/${fileId}`;
  const isImage = !!file?.content_type.startsWith("image/");
  const name = file?.filename ?? "사업자등록증";
  const stage = useRef<HTMLDivElement>(null);
  const [base, setBase] = useState(420);
  const [zoom, setZoom] = useState(100);
  const [rot, setRot] = useState(0);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [broken, setBroken] = useState(false);

  // 100%는 칸 너비(최대 420px)에 맞춘다
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const fit = () => setBase(Math.max(160, Math.min(420, el.clientWidth - 48)));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const i = ZOOMS.indexOf(zoom);
  const w = (base * zoom) / 100;
  const h = nat ? (w * nat.h) / nat.w : 0;
  const side = rot % 180 !== 0;
  const tools = isImage && !broken;
  const newTab = <a className="mj-btn mj-btn-sec mj-btn-sm" href={src} target="_blank" rel="noopener">새 탭에서 열기<span className="mj-sr">, 새 창</span></a>;

  return (
    <figure aria-labelledby="doc-cap" className={s.fig}>
      <div className={s.bar}>
        <figcaption id="doc-cap" className="mj-small">
          <span className={s.name}>{name}</span>
          {file ? <span className="mj-num"> · {fileSize(file.size)} · {stampSeoul(new Date(file.created_at))} 받음</span> : null}
          {changedFrom ? <span> · 새로 올린 파일 (전: {changedFrom})</span> : null}
        </figcaption>
        {tools ? (
          <div role="group" aria-label="서류 보기 도구" className={s.tools}>
            <button type="button" className={`mj-btn mj-btn-sec mj-btn-sm ${s.ib}`} aria-label="축소" disabled={i <= 0} onClick={() => setZoom(ZOOMS[i - 1])}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="8" cy="8" r="5.5" /><path d="M12 12l4.5 4.5" /><path d="M5.5 8h5" /></svg>
            </button>
            <span className={`mj-small mj-num ${s.zoom}`} aria-live="polite"><span className="mj-sr">서류 배율 </span>{zoom}%</span>
            <button type="button" className={`mj-btn mj-btn-sec mj-btn-sm ${s.ib}`} aria-label="확대" disabled={i >= ZOOMS.length - 1} onClick={() => setZoom(ZOOMS[i + 1])}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="8" cy="8" r="5.5" /><path d="M12 12l4.5 4.5" /><path d="M5.5 8h5M8 5.5v5" /></svg>
            </button>
            <button type="button" className={`mj-btn mj-btn-sec mj-btn-sm ${s.ib}`} aria-label="오른쪽으로 90도 돌리기" onClick={() => setRot((r) => (r + 90) % 360)}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14.5 9.5A5.5 5.5 0 1 1 9 4h3.5" /><path d="M10.5 1.8L12.8 4 10.5 6.3" /></svg>
            </button>
          </div>
        ) : newTab}
      </div>
      <div ref={stage} className={s.stage} role="region" tabIndex={0} aria-label="사업자등록증 보기">
        {!isImage || broken ? (
          <div className={s.pdf}>
            <svg width="40" height="52" viewBox="0 0 40 52" fill="none" aria-hidden="true"><rect x="0.5" y="0.5" width="39" height="51" rx="2" fill="var(--bg)" stroke="var(--line-strong)" /><path d="M8 9h22" stroke="var(--ink)" strokeWidth="3" /><path d="M7 18h26M7 24h26M7 30h26M7 36h18" stroke="var(--line-paper)" /></svg>
            <p>{broken ? "서류를 불러오지 못했어요. 새 탭에서 열어 봐요." : file ? "PDF 파일이에요. 확대 · 돌리기 대신 새 탭에서 열어 봐요." : "파일 정보를 읽지 못했어요. 새 탭에서 열어 봐요."}</p>
          </div>
        ) : (
          <div className={s.frame} style={nat ? { width: side ? h : w, height: side ? w : h } : { width: w }}>
            {/* 업체가 올린 파일이라 크기를 미리 알 수 없어 img를 쓴다 */}
            <img
              src={src}
              alt={`사업자등록증 · ${name}`}
              className={nat ? s.turned : s.img}
              style={nat ? { width: w, height: h, transform: `translate(-50%, -50%) rotate(${rot}deg)` } : { width: w }}
              onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth || 1, h: e.currentTarget.naturalHeight || 1 })}
              onError={() => setBroken(true)}
            />
          </div>
        )}
      </div>
    </figure>
  );
}
