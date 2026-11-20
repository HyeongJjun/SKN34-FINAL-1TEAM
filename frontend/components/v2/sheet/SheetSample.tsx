"use client";
// 표준견적서 견본: 계산 엔진으로 미리 만든 예시(lib/mock/quoteSheet.ts)를 골라 본다. API · 로그인 없이 열린다.
import { useState } from "react";
import { SHEET_SAMPLES } from "@/lib/mock/quoteSheet";
import { SheetView } from "./SheetPage";
import s from "./SheetPage.module.css";

export function SheetSample() {
  const [key, setKey] = useState(SHEET_SAMPLES[1]?.key ?? SHEET_SAMPLES[0].key);
  const cur = SHEET_SAMPLES.find((x) => x.key === key) ?? SHEET_SAMPLES[0];
  const top = (
    <div className={s.sample}>
      <p className={s.sampleNote}>견본이에요. 미리 계산한 예시 집 중 하나를 골라 보세요.</p>
      <div className={s.picks} role="radiogroup" aria-label="예시 집 고르기">
        {SHEET_SAMPLES.map((x) => (
          <button
            key={x.key}
            type="button"
            role="radio"
            aria-checked={x.key === key}
            className={`${s.pick} ${x.key === key ? s.pickOn : ""}`}
            onClick={() => setKey(x.key)}
          >
            {x.label}
          </button>
        ))}
      </div>
    </div>
  );
  return <SheetView q={cur.sheet} top={top} back={{ href: "/", label: "처음 화면으로" }} />;
}
