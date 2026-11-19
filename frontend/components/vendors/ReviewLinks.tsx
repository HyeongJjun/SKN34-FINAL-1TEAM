"use client";
// 업체가 연결한 외부 리뷰(C11 · C48): 관리자가 확인한 https 링크만, 새 창으로 열어요. 줄마다 '링크 신고'(C31 창, 링크 이유).
// 주소는 업체가 넣은 값이라 화면에 그대로 그리지 않고 이름(label)만 보여요. 이름이 없으면 '외부 리뷰 n'.
import { useState } from "react";
import { ReportSheet } from "@/components/report/ReportSheet";
import { Button } from "@/components/ui/Button";
import type { Schemas } from "@/lib/backend/client";
import s from "./vendors3.module.css";

type ExtLink = Schemas["ReviewLinkOut"];

export function ReviewLinks({ vendorId, links, title = true }: { vendorId: string; links: ExtLink[]; /** 묶음 이름 '업체가 연결한 외부 리뷰 2'를 보여요 */ title?: boolean }) {
  const [target, setTarget] = useState<{ sort: number; label: string } | null>(null);
  if (!links.length) return null;
  const nameOf = (l: ExtLink, i: number) => l.label?.trim() || `외부 리뷰 ${i + 1}`;
  return (
    <div className={s.extLinks}>
      {title ? <p className={s.eb}>업체가 연결한 외부 리뷰 <span className="mj-num">{links.length}</span></p> : null}
      <ul className={s.links}>
        {links.map((l, i) => (
          <li key={l.sort}>
            <a className={s.ext} href={l.url} target="_blank" rel="noopener noreferrer nofollow ugc">
              <b>{nameOf(l, i)}</b>
              <span>새 창에서 열려요 <span aria-hidden="true">↗</span></span>
            </a>
            {/* A1 · A2: 링크가 여럿이라 읽는 이름에 링크 이름을 붙여요 */}
            <Button variant="text" gray onClick={() => setTarget({ sort: l.sort, label: nameOf(l, i) })} aria-haspopup="dialog" aria-label={`${nameOf(l, i)} 링크 신고`}>링크 신고</Button>
          </li>
        ))}
      </ul>
      <ReportSheet
        open={target !== null}
        onClose={() => setTarget(null)}
        kind="link"
        targetName={target?.label ?? "링크"}
        vendorId={vendorId}
        linkSort={target?.sort}
      />
    </div>
  );
}
