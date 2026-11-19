"use client";
// 요청 내용 보기(C15): 요청 때 보낸 것 · 고정된 가견적 · 보내지 않은 것. 모두 API · 기본 정보 값을 모양만 바꿔요.
import { useState } from "react";
import type { BoardRow, VisitBoard, VisitProject } from "@/lib/api/visit";
import { dateLong, dateSeoul, rangeText, won } from "@/lib/format";
import { gradeLabel } from "@/lib/labels";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { Row, Rows } from "@/components/project/Kit";
import { homeLine } from "./text";
import s from "./visit.module.css";

type Head = NonNullable<VisitBoard["head"]>;

export function RequestSheet({ open, onClose, head, rows, project }: { open: boolean; onClose: () => void; head: Head; rows: BoardRow[]; project: VisitProject }) {
  const priced = rows.filter((r) => r.estimate_total != null);
  return (
    <Sheet open={open} onClose={onClose} title={`${dateLong(dateSeoul(head.sent_at))}에 보낸 요청`}>
      <Rows>
        <Row label="희망 기간" value={head.wish_start && head.wish_end ? rangeText(head.wish_start, head.wish_end, { weekday: true }) : "없음"} valueSub />
        <Row label="보낸 업체" value={rows.map((r) => r.vendor_name).join(" · ")} valueSub />
        <Row label="보낸 내용" value={homeLine(project)} valueSub />
        <Row label="벽지" value={gradeLabel(project.grade)} valueSub />
        <Row label="예산" value={project.budgetWon != null ? won(project.budgetWon) : "아직 몰라요"} valueSub />
        {priced.length ? (
          <Row
            label="고정된 가견적"
            sub={priced.map((r) => r.vendor_name).join(" · ")}
            value={<span className={s.lines}>{priced.map((r) => <span key={r.visit_id}>{won(r.estimate_total!)}</span>)}</span>}
            valueSub
          />
        ) : null}
        <Row label="사진" sub="위치 정보 지움" value={head.photos.length ? `${head.photos.length}장` : "없음"} valueSub />
        <Row label="보내지 않은 것" value="이름 · 휴대폰 · 동 · 호수" valueSub />
      </Rows>
    </Sheet>
  );
}

/** '요청 내용' 글자 단추 + 시트(이 화면 안 동작이라 › 없이) */
export function RequestSheetButton({ head, rows, project }: { head: Head; rows: BoardRow[]; project: VisitProject }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="text" onClick={() => setOpen(true)} aria-haspopup="dialog">요청 내용</Button>
      <RequestSheet open={open} onClose={() => setOpen(false)} head={head} rows={rows} project={project} />
    </>
  );
}
