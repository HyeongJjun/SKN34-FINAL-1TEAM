"use client";
// 로그인 전 표준견적서 왼쪽 재재 대화(재재 공사 화면과 같은 말풍선 모양). 입력 칸 없이 자주 묻는 질문 칩만.
// 서버 AI 없음(카드 파일만 읽는 GET /ai/faq). 가입하면 같은 답으로 공사가 만들어지고 재재 화면에서 이어 물어요.
import { useEffect, useState } from "react";
import { Jaejae } from "@/components/secretary/Jaejae";
import { Button } from "@/components/ui/Button";
import { errorText } from "@/lib/backend/client";
import { getAiFaq, type AiFaq } from "@/lib/api/chat";
import f from "@/components/secretary/flow.module.css";
import s from "./standard.module.css";

export function GuestJaejae({ onJoin, ready }: { onJoin: () => void; ready: boolean }) {
  const [faq, setFaq] = useState<AiFaq[]>([]);
  const [asked, setAsked] = useState<AiFaq[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    getAiFaq().then((x) => live && setFaq(x.slice(0, 4))).catch((e) => live && setError(errorText(e)));
    return () => { live = false; };
  }, []);
  const left = faq.filter((x) => !asked.some((a) => a.id === x.id));
  return (
    <section className={s.chat} aria-label="재재와 대화">
      <div className={f.msgs} role="log" aria-live="polite">
        <div className={f.bot}><div className={f.face}><Jaejae mouth="smile" /></div><div className={f.bubble}><span className={f.who}>재재 · 믿집 비서</span>
          <p>{ready ? "표준견적서가 나왔어요. 오른쪽에서 줄마다 수량 · 금액을 볼 수 있어요." : "넣은 기본 정보로 표준견적서를 계산하고 있어요."}</p>
          <p>표준견적서는 믿집이 계산한 <b>참고 금액</b>이에요. 업체 견적이 아니에요.</p>
        </div></div>
        {asked.map((a) => (
          <div key={a.id} className={f.msgs} style={{ padding: 0 }}>
            <p className={f.me}>{a.question}</p>
            <div className={f.bot}><div className={f.face}><Jaejae mouth="smile" /></div><div className={f.bubble}><span className={f.who}>재재 · 자주 묻는 질문</span>
              {a.sentences.map((t, i) => <p key={i}>{t}</p>)}
              {a.tip ? <p className={f.why}>팁: {a.tip}</p> : null}
            </div></div>
          </div>
        ))}
        {error ? <p className="mj-error" role="alert">{error}</p> : null}
        <div className={f.bot}><div className={f.face}><Jaejae mouth="open" /></div><div className={f.bubble}><span className={f.who}>재재 · 믿집 비서</span>
          <p>가입하면 넣은 답 그대로 내 공사가 만들어지고, 업체 가견적 비교 · 실측 날짜 잡기를 저와 같이 해요.</p>
          <Button size="sm" onClick={onJoin}>가입하고 재재와 이어 하기</Button>
        </div></div>
      </div>
      {left.length ? (
        <div className={f.quick} role="group" aria-label="이런 걸 물어보세요">
          {left.map((q) => <button key={q.id} type="button" className={f.chip} onClick={() => setAsked((a) => [...a, q])}>{q.question}</button>)}
        </div>
      ) : null}
      <p className={s.chatNote}>로그인하면 재재에게 직접 물어볼 수 있어요.</p>
    </section>
  );
}
