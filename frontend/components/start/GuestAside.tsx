"use client";
// 로그인 전 'AI에게 묻기'(C58 · D12): AI는 로그인한 고객만 써요(security-02 8). 그 전에는 자주 묻는 질문 칩(정적 글)만 보여요.
// 웹 ≥1024는 옆 칸, 폰은 머리 'AI에게 묻기'(GuestAskButton)로 여는 아래 시트예요. AI 호출은 하지 않아요.
// B5 GuestAsk 조각이 생기면 이 파일만 바꿔요(routes.md C58).
import Link from "next/link";
import { AsidePanel } from "@/components/site/AsideSlot";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { GUEST_CHIPS, faqById } from "@/components/home/faq";
import s from "./standard.module.css";

export const GUEST_ASK_EVENT = "mj:guest-ask";

function Chips() {
  return (
    <ul className={s.chips} aria-label="자주 묻는 질문">
      {GUEST_CHIPS.map((id) => {
        const f = faqById(id);
        return f ? <li key={id}><Link className={s.chip} href={`/faq#${id}`}>{f.q}</Link></li> : null;
      })}
    </ul>
  );
}

/** 웹 옆 칸(D12) */
export function GuestAside({ onJoin }: { onJoin: () => void }) {
  return (
    <AsidePanel title="AI 채팅" listLabel="자주 묻는 질문">
      <p className={s.guestInfo}><b>로그인하면 AI에게 물을 수 있어요.</b> 그 전에는 자주 묻는 질문을 봐요.</p>
      <Chips />
      <Button variant="weak" size="sm" onClick={onJoin}>가입 · 로그인</Button>
    </AsidePanel>
  );
}

/** 폰 아래 시트(C58) */
export function GuestAskSheet({ open, onClose, onJoin }: { open: boolean; onClose: () => void; onJoin: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="로그인하면 AI에게 물을 수 있어요" actions={<Button size="lg" block onClick={onJoin}>가입 · 로그인</Button>}>
      <p className={s.sheetSub}>그 전에는 자주 묻는 질문을 볼 수 있어요.</p>
      <Chips />
    </Sheet>
  );
}

/** 폰 머리 오른쪽 'AI에게 묻기'(C57). 누르면 같은 화면의 시트를 열어요 */
export function GuestAskButton() {
  return <button type="button" className={s.askBtn} onClick={() => window.dispatchEvent(new Event(GUEST_ASK_EVENT))}>AI 채팅</button>;
}
