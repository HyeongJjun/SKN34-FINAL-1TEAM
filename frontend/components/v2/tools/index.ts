// tools 단계 함수를 F 표에 넣는다: 셀프 계산기 · 체크리스트 · 받은 견적 맞춰 보기 (v10 calcStep · checkStep · STEP_FN.calc/check)
import { createElement } from "react";
import { bot, F, register } from "../engine";
import { STEP_NAMES } from "../flow";
import { CalcCard } from "./CalcCard";
import { CheckCard } from "./CheckCard";

export async function calcStep(kind?: "wall" | "trim" | "paint") {
  await bot(null, createElement(CalcCard, { kind }));
}
export async function checkStep(which?: "before" | "contract" | "after") {
  await bot(null, createElement(CheckCard, { which }));
}
/** 받은 견적 맞춰 보기 (견적서에서 옮김): 다른 곳에서 받은 도배 · 목공 견적을 시장 기준과 견준다 */
export async function compareStep() {
  await bot("다른 곳에서 받은 도배 · 목공 견적 금액과 포함 범위를 넣어 보세요. 같은 범위의 시장 기준과 견줘 볼게요.", F.quoteCheckCard?.());
}

register({ calcStep, checkStep, compareStep });
/* 상담 화면 단계 이름 → 도구 카드 (v10 STEP_FN.calc · STEP_FN.check). stepFn("calc")가 이 이름으로 F를 찾는다 */
STEP_NAMES.calc = "calcStep";
STEP_NAMES.check = "checkStep";
