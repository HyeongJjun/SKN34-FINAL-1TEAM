"use client";
// 홈 한 줄 입력(시연 피드백 11-20 · 11-23): "어떤 집을 고치려고 하세요?"에 한 줄로 적고 '인테리어 시작하기'를 누르면
// 표준견적서 받기(/start)의 재재 대화가 그 말로 시작해요. 말은 이 탭(sessionStorage)으로만 넘기고 주소에 넣지 않아요.
// 진행 중인 공사가 있으면 기존 '표준견적서 받기'(이어 하기 / 새 집 묻기)를 그대로 써요.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { START_SAY_KEY } from "@/components/start/StartChat";
import s from "./home.module.css";

const EXAMPLE = "노원구 24평 아파트 도배하려고요. 지금 살고 있어요";

export function HomeAsk() {
  const router = useRouter();
  const [text, setText] = useState("");
  function go() {
    const v = text.trim().slice(0, 300);
    try { if (v) window.sessionStorage.setItem(START_SAY_KEY, v); } catch { /* 막혀도 빈 대화로 시작해요 */ }
    router.push("/start");
  }
  return (
    <form className={s.ask} onSubmit={(e) => { e.preventDefault(); go(); }}>
      <label htmlFor="home-ask" className={s.askLabel}>어떤 집을 고치려고 하세요?</label>
      <textarea id="home-ask" className={s.askInput} rows={2} maxLength={300} value={text} placeholder={`예: ${EXAMPLE}`}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); go(); } }} />
      <div className={s.askRow}>
        <Button variant="text" size="sm" type="button" onClick={() => setText(EXAMPLE)}>예시 문장 넣기</Button>
        <Button size="lg" type="submit">인테리어 시작하기</Button>
      </div>
    </form>
  );
}
