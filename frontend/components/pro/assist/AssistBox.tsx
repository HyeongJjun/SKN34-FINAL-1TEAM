"use client";
// 업체 도우미 칸: 말로 적으면 아래 폼 칸을 대신 채워요. 보내기 · 제출은 업체가 직접 눌러요.
// 값 뽑기는 parse.ts의 규칙이고, 서버에 묻거나 저장하지 않아요.
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import s from "./assist.module.css";

export function AssistBox({ hint, examples, onText }: {
  /** 무엇을 말하면 되는지 한 줄 */
  hint: string;
  /** 눌러서 넣는 예시 글 */
  examples: string[];
  /** 글을 받아 폼을 채우고, 업체에게 보여 줄 답을 돌려줘요 */
  onText: (text: string) => string;
}) {
  const [text, setText] = useState("");
  const [log, setLog] = useState<{ me: string; bot: string } | null>(null);
  function go() {
    const t = text.trim();
    if (!t) return;
    setLog({ me: t, bot: onText(t) });
    setText("");
  }
  return (
    <section className={s.box} aria-label="업체 도우미">
      <p className={s.head}><b>재재 · 업체 도우미</b><span>{hint}</span></p>
      {log ? (
        <div className={s.log} aria-live="polite">
          <p className={s.me}>{log.me}</p>
          <p className={s.bot}>{log.bot}</p>
        </div>
      ) : null}
      <div className={s.row}>
        <textarea
          className={s.input}
          rows={1}
          value={text}
          maxLength={200}
          placeholder="재재에게 말해 보세요"
          aria-label="업체 도우미에게 보낼 말"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); go(); } }}
        />
        <Button size="sm" variant="secondary" onClick={go}>칸 채우기</Button>
      </div>
      <div className={s.ex}>
        {examples.map((x) => <button key={x} type="button" className={s.exBtn} onClick={() => setText(x)}>{x}</button>)}
      </div>
    </section>
  );
}
