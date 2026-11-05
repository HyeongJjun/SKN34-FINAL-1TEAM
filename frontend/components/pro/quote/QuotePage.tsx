// 실측 견적서 올리기 화면 틀 (시안 WVQuote): 이동 경로 + 요청 요약(서버에서 그림) + 올리기 · 보낸 견적서(QuoteBoard).
// 가견적 비교('표준견적서 · 가견적 더 보기')는 업체 쪽 API에 없어서 뺐다.
import Link from "next/link";
import { endLabel, endNote, isDone, workText, type Detail } from "@/components/pro/inbox/text";
import { phoneText } from "@/lib/labels";
import { QuoteBoard } from "./QuoteBoard";
import type { Board } from "./text";
import s from "./quote.module.css";

function Brief({ v }: { v: Detail }) {
  const c = v.customer;
  return (
    <dl className={s.brief}>
      <div><dt>요청</dt><dd><span className={s.code}>{v.code}</span> · {workText(v)}</dd></div>
      {c ? <div><dt>고객</dt><dd>{c.name}{c.phone ? <> · <span className="mj-num">{phoneText(c.phone)}</span></> : null}</dd></div> : null}
      <div><dt>집</dt><dd className="mj-num">{v.home_text}</dd></div>
      {isDone(v.status) ? null : <div><dt>희망 시기</dt><dd className="mj-num">{v.when_text}</dd></div>}
    </dl>
  );
}

export function QuotePage({ v, board, today }: { v: Detail; board: Board; today: string }) {
  const who = v.customer?.name ?? null;
  const here = who ? `${who} · ${v.area_name} ${workText(v)} 실측 견적서` : `${v.code} 실측 견적서`;
  return (
    <>
      <nav className={`mj-wrap mj-crumb ${s.crumb}`} aria-label="이동 경로">
        <ol>
          <li><Link href="/vendor">작업함</Link><span aria-hidden="true">›</span></li>
          <li><span aria-current="page">{here}</span></li>
        </ol>
      </nav>
      <main id="main" className={`mj-wrap ${s.page}`}>
        <QuoteBoard
          visitId={v.id}
          initial={board}
          today={today}
          who={who}
          closedText={isDone(v.status) ? `${endLabel(v)} · ${endNote(v)}` : null}
          brief={<Brief v={v} />}
        />
      </main>
    </>
  );
}
