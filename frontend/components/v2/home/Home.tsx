"use client";
// 첫 화면 (v10 showHome 최종: 큰 사진 + 내 인테리어 + 사진 줄 + 자주 묻는 질문).
// v10 덧씌움에서 '우리 집에 칠해 보기'(ToneRoom)와 '견적서에 나오는 말'(PartsGuide)은 빠져 있어 여기서도 그리지 않는다.
import { goChat } from "../V2App";
import { FaqSection } from "./Faq";
import { HomeStage } from "./HomeStage";
import { LookStrip } from "./LookStrip";
import { MyCases } from "./MyCases";

export function Home() {
  return (
    <div className="wrap home">
      <section className="hero">
        <div className="hero-t">
          <h1>
            사진으로 고르는
            <br />
            우리 집 인테리어
          </h1>
          <div className="cta">
            <a className="btn btn-pri" href="#chat" onClick={() => goChat("new")}>시작하기</a>
            <a className="btn" href="#chat" onClick={() => goChat("quick")}>자재부터 볼게요</a>
          </div>
          <ol className="flow-mini" aria-label="진행 순서">
            {["스타일", "집 정보", "자재", "견적서 · 공정표"].map((t, k) => (
              <li key={t}>
                <span>{k + 1}</span>
                {t}
              </li>
            ))}
          </ol>
        </div>
        <HomeStage />
      </section>
      <MyCases />
      <LookStrip />
      <FaqSection />
    </div>
  );
}
