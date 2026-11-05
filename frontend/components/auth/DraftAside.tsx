"use client";
// 가입 · 로그인 화면 오른쪽 '작성 중인 집 정보'. 견적 받기 초안(브라우저 저장)이 있을 때만 보인다.
import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { DRAFT_EVENT, PHOTO_MEMO, draftLine, readDraft } from "@/components/start/draft";
import s from "./auth.module.css";

type View = { rows: { label: string; value: string }[]; photos: number; plans: number };

function read(): View | null {
  const d = readDraft();
  if (!d) return null;
  return { rows: draftLine(d.a), photos: Object.values(PHOTO_MEMO.bySpace).flat().length, plans: PHOTO_MEMO.plan.length };
}

export function DraftAside({ action }: { action: "가입" | "로그인" }) {
  const [v, setV] = useState<View | null>(null);
  useEffect(() => {
    const up = () => setV(read());
    up();
    window.addEventListener(DRAFT_EVENT, up);
    window.addEventListener("storage", up);
    return () => { window.removeEventListener(DRAFT_EVENT, up); window.removeEventListener("storage", up); };
  }, []);
  if (!v) return null;
  const files = [v.photos && `사진 ${v.photos}장`, v.plans && `도면 ${v.plans}장`].filter(Boolean).join(" · ");
  return (
    <aside className={s.aside} aria-labelledby="draft-t">
      <div className={s.draft}>
        <h2 id="draft-t" className="mj-h3">작성 중인 집 정보</h2>
        {v.rows.length || files ? (
          <dl className={`mj-num ${s.dl}`}>
            {v.rows.map((r) => <Fragment key={r.label}><dt>{r.label}</dt><dd>{r.value}</dd></Fragment>)}
            {files ? <><dt>사진</dt><dd>{files}</dd></> : null}
          </dl>
        ) : null}
        <p>{action}하면 넣은 집 정보{files ? " · 사진" : ""} 그대로 이어서 계산해요.</p>
        <p><Link className="mj-lnk" href="/start">내용 고치기</Link></p>
      </div>
    </aside>
  );
}
