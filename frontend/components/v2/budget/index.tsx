"use client";
// 첫 질문(무엇이 궁금해서 왔는지) · 빠른 예산 · 빠른 예산 → 표준견적서.
// 목적이 곧 수준 신호다: 순서부터 = 처음, 예산 · 업체 = 알아보는 중, 받은 견적 = 견적 받아 봄.
import { CATS } from "../data";
import { bot, clearQuick, F, me, quick, register } from "../engine";
import { autoPick, setStep } from "../flow";
import { welcome as styleWelcome } from "../intake/StyleRail";
import { planById } from "../intake/plans";
import { loadMok, mok10DefaultPick } from "../materials/state";
import { type Goal, type Level, type QuickAns, S, touch, useV2 } from "../store";
import s from "./budget.module.css";
import { freshAns, QuickCard } from "./QuickCard";

const GOALS: [Goal, string, string, Level][] = [
  ["budget", "예산만 빨리 알고 싶어요", "집 · 범위 · 바꿀 것 · 도배 유형만 물어요", "looking"],
  ["learn", "인테리어가 처음이라 순서부터요", "공사 순서와 낱말을 짧게 보고 금액으로 가요", "new"],
  ["check", "받은 견적이 맞는지 보고 싶어요", "받은 금액과 포함 범위를 넣어 맞춰 봐요", "experienced"],
  ["vendor", "업체를 찾고 있어요", "기준 금액을 보고 업체 견적으로 이어 가요", "looking"],
];

function GoalCard() {
  const st = useV2();
  return (
    <div className={`card ${s.goals}${st.goal ? " done" : ""}`}>
      {GOALS.map(([g, t, d]) => (
        <button key={g} type="button" className={s.goal} onClick={() => chooseGoal(g)}>
          <b>{t}</b>
          <span>{d}</span>
        </button>
      ))}
      <button type="button" className={`btn-text ${s.more}`} onClick={() => { clearQuick(); styleWelcome(); }}>
        스타일 사진부터 볼게요
      </button>
    </div>
  );
}

export async function welcome() {
  await bot("무엇이 궁금해서 오셨어요? 고르면 그에 맞게 안내할게요. 그냥 물어보셔도 돼요.", <GoalCard />);
}

export async function chooseGoal(g: Goal) {
  const [, t, , lv] = GOALS.find((x) => x[0] === g)!;
  S.goal = g;
  S.level = lv;
  touch();
  me(t);
  clearQuick();
  if (g === "check") return F.compareStep();
  if (g === "learn") {
    await F.guideStep(false);
    quick([["우리 집 금액 보기", () => budgetStep()]]);
    return;
  }
  return budgetStep();
}

export async function budgetStep() {
  setStep("info");
  const lead = S.goal === "vendor" ? "업체 견적을 받기 전에 우리 집 기준 금액부터 볼게요. " : "";
  await bot(
    `${lead}네 가지만 물어볼게요. 모르는 건 비워 두면 흔한 값으로 계산하고 무엇으로 봤는지 적어 드려요.`,
    <QuickCard init={S.quick ?? freshAns()} onQuote={toQuote} onAsk={(q) => F.askClaude(q, { label: q })} />,
  );
}

/** 빠른 예산 답을 표준견적서 입력으로 옮긴다. 다시 묻지 않고 바로 견적서로 간다 */
export async function toQuote(a: QuickAns, planId: string | null) {
  S.quick = a;
  S.grade = a.grade ?? "basic";
  S.tier = S.grade;
  S.tierBy = "me";
  const pl = planId ? planById(planId) : null;
  S.info.pyeong = pl ? pl.supply_py : a.pyeong && a.basis === "exclusive" ? Math.round(a.pyeong * 12) / 10 : a.pyeong;
  if (a.occupied != null) S.info.living = a.occupied ? "living" : "vacant";
  const mok = a.molding || a.base || (a.door != null && a.door !== "none");
  const cats = [a.dobae ? "wallpaper" : null, mok ? "carpentry" : null].filter((c): c is string => !!c);
  S.scope = { kind: a.kinds || cats.length < CATS.length ? "part" : "all", spaces: [], cats, kinds: a.kinds };
  S.plan = pl ? { kind: "apt", id: pl.id, name: `${pl.name} ${pl.type}`, expanded: true } : null;
  await loadMok();
  S.mok10 = undefined;
  const m = F.mok10St();
  if (!a.molding) m.molding = { type: "none", pick: null };
  if (!a.base) m.base = { pick: null };
  if (a.door === "leaf" || a.door === "frame") {
    const mode = a.door === "frame" ? "replace" : "leaf";
    m.door = { mode, pick: mok10DefaultPick(mode), count: null };
  }
  autoPick();
  S.guideSeen = true;
  S.far = Math.max(S.far, 6);
  touch();
  me("이 조건으로 표준견적서 만들어 주세요");
  await F.quoteStep();
}

register({ welcome, budgetStep, chooseGoal });
