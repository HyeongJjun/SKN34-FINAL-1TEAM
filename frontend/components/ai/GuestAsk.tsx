// 로그인 전 AI 칸(C58 ai_guest · D12, 9판 N1 A): 입력 칸 없이 자주 묻는 질문 칩만. 누르면 검증된 카드 답을 그대로 보여요.
// 서버 계산 없음(카드 파일만 읽는 GET /ai/faq). 가입 · 로그인하면 AI에게 물을 수 있어요.
"use client";

import { useEffect, useState } from "react";
import { AsidePanel } from "@/components/site/AsideSlot";
import { Button } from "@/components/ui/Button";
import { errorText } from "@/lib/backend/client";
import { getAiFaq, type AiFaq } from "@/lib/api/chat";
import s from "./ai.module.css";

export function GuestAsk({ signupHref = "/signup", onJoin }: {
  signupHref?: string;
  /** 가입 카드를 같은 화면에서 열 때(답 옮기기, dev-03). 있으면 링크 대신 이걸 불러요 */
  onJoin?: () => void;
}) {
  const [faq, setFaq] = useState<AiFaq[]>([]);
  const [open, setOpen] = useState<AiFaq | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    getAiFaq()
      .then((x) => live && setFaq(x.slice(0, 3)))
      .catch((e) => live && setError(errorText(e)));
    return () => {
      live = false;
    };
  }, []);

  const foot = onJoin
    ? <Button size="lg" block onClick={onJoin}>가입 · 로그인</Button>
    : <Button size="lg" block href={signupHref}>가입 · 로그인</Button>;
  return (
    <AsidePanel title="AI 채팅" listLabel="자주 묻는 질문" foot={foot}>
      <div className={s.msgs}>
        <div className={s.guestHead}>
          <p className={s.guestTitle}>로그인하면 AI에게 물을 수 있어요</p>
          <p className={s.viewing}>그 전에는 자주 묻는 질문을 볼 수 있어요.</p>
        </div>
        {error ? <p className={s.error} role="alert">{error}</p> : null}
        <div className={s.choices}>
          {faq.map((f) => (
            <Button key={f.id} variant={open?.id === f.id ? "secondary" : "weak"} size="sm" onClick={() => setOpen(f)} aria-pressed={open?.id === f.id}>
              {f.question}
            </Button>
          ))}
        </div>
        {open ? (
          <div className={s.answer} aria-live="polite">
            <p className={s.notice}>자주 묻는 질문</p>
            {open.sentences.map((t, i) => <p key={i}>{t}</p>)}
            {open.tip ? <p className={s.tip}>팁: {open.tip}</p> : null}
          </div>
        ) : null}
      </div>
    </AsidePanel>
  );
}
