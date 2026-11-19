"use client";
// 리뷰 기준(C49): 누가 쓰고 · 얼마나 보이고 · 어떤 리뷰를 내리고 · 이의는 어떻게 하는지 공개해요(전자상거래법 제21조의4, 문구는 예시 · 팀 확인 8).
// 글 속 얇은 밑줄 단추 '리뷰 기준'을 누르면 시트(폰) · 가운데 창(웹)으로 열려요. 같은 화면 안이라 ›를 붙이지 않아요.
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import s from "./review.module.css";

const RULES = [
  { label: "누가 써요", text: "믿집에서 공사를 끝내고 '공사 끝 확인'을 누른 고객이 공사마다 한 번 써요" },
  { label: "얼마나 보여요", text: "쓴 고객이 지우지 않으면 계속 보여요" },
  { label: "어떤 리뷰를 내려요", text: "욕설 · 개인정보 · 공사와 상관없는 글 · 대가를 받고 쓴 글" },
  { label: "이의가 있으면", text: "업체 · 고객 누구나 '신고'로 알리면 믿집이 확인하고 결과를 알려 드려요" },
];

/** '믿집에서 공사를 끝낸 고객만 써요 · 리뷰 기준' 줄 */
export function ReviewRulesLine({ lead = "믿집에서 공사를 끝낸 고객만 써요" }: { lead?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <p className={s.rules}>{lead} · <Button variant="inline" onClick={() => setOpen(true)} aria-haspopup="dialog">리뷰 기준</Button></p>
      <Sheet open={open} onClose={() => setOpen(false)} title="리뷰 기준">
        <dl className={s.ruleList}>
          {RULES.map((r) => <div key={r.label}><dt>{r.label}</dt><dd>{r.text}</dd></div>)}
        </dl>
      </Sheet>
    </>
  );
}
