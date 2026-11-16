// AI가 화면을 움직이는 도구의 실행 부분 (v10 claudeTools).
// 도구 이름 · 설명 · 입력 모양은 서버(backend/app/v2/ask_tools.py)가 정한다. 여기서는 받은 값을 검사하고 실행만 한다.
// 공사비(price_reference) · 공정표 조건(set_schedule_constraints) · 지식 검색(search_knowledge) ·
// 이어 물을 질문(suggest_questions)은 서버가 실행한다.
import { flashBoard } from "../Board";
import { CATS, manwon, SPACES, STYLES, TIER_ORDER, TIERS } from "../data";
import { moveLabel } from "../dates";
import { autoPick, fillPicks, STEP_NAMES, tierFromBudget } from "../flow";
import { DATA, S, touch, type Tier } from "../store";
import type { AiTool } from "./llm";

export type After = { step?: string };
/** AI가 담자고 제안한 값. 고객이 [담기]를 눌러야 apply로 보드에 저장한다 */
export type Pending = { label: string; apply: () => void };

/** show_step이 고를 수 있는 단계 */
const stepKeys = () => [...new Set(["styles", "guide", ...Object.keys(STEP_NAMES)])];

/** 저장하는 도구는 바로 저장하지 않고 제안만 쌓는다(확정 · 저장은 고객이 누른 버튼으로만) */
const proposed = { ok: true, saved: false, note: "고객이 화면에서 [담기]를 눌러야 저장돼요" };

export function claudeTools(pending: Pending[], after: After): AiTool[] {
  const changed = () => {
    touch();
    flashBoard();
  };
  const propose = (label: string, apply: () => void) => {
    pending.push({
      label,
      apply: () => {
        apply();
        changed();
      },
    });
    return proposed;
  };
  return [
    {
      name: "set_style",
      execute: ({ style_id }: { style_id: string }) => {
        const st = STYLES.find((s) => s.id === style_id);
        if (!st) throw new Error("없는 스타일");
        return propose(st.ko, () => {
          S.style = st.id;
          if (S.far >= 5) autoPick();
        });
      },
    },
    {
      name: "set_home_info",
      execute: (a: { pyeong?: number; region?: string; living?: "living" | "vacant"; move?: string }) => {
        const labels: string[] = [];
        const fx: (() => void)[] = [];
        if (a.pyeong != null) {
          if (!(a.pyeong >= 10 && a.pyeong <= 90)) throw new Error("평형은 10~90");
          const py = Math.round(a.pyeong);
          labels.push(`${py}평`);
          fx.push(() => (S.info.pyeong = py));
        }
        if (a.region) {
          const region = String(a.region).slice(0, 30);
          labels.push(region);
          fx.push(() => (S.info.region = region));
        }
        if (a.living === "living" || a.living === "vacant") {
          const lv = a.living;
          labels.push(lv === "living" ? "살면서 공사" : "빈집");
          fx.push(() => (S.info.living = lv));
        }
        if (a.move && /^\d{4}-\d{2}(-\d{2})?$/.test(a.move)) {
          const mv = a.move;
          labels.push(`${moveLabel(mv)} 입주`);
          fx.push(() => (S.info.move = mv));
        }
        if (!labels.length) throw new Error("담을 집 정보가 없어요");
        return propose(labels.join(" · "), () => fx.forEach((f) => f()));
      },
    },
    {
      name: "set_scope",
      execute: ({ kind, spaces = [] }: { kind: "all" | "part"; spaces?: string[] }) => {
        if (kind !== "all" && kind !== "part") throw new Error("범위는 all · part");
        if (kind === "all")
          return propose("집 전체", () => {
            Object.assign(S.scope, { kind, spaces: [], cats: [], kinds: null });
            if (S.far >= 5) fillPicks();
          });
        const sp = SPACES.filter((s) => spaces.includes(s.id));
        if (!sp.length) throw new Error("공간을 하나 이상 골라야 해요");
        const c = new Set(sp.flatMap((s) => s.cats));
        return propose(sp.map((s) => s.ko).join(", "), () => {
          Object.assign(S.scope, { kind, spaces: sp.map((s) => s.id), cats: CATS.filter((x) => c.has(x.id)).map((x) => x.id), kinds: null });
          if (S.far >= 5) fillPicks();
        });
      },
    },
    {
      name: "set_budget",
      execute: ({ budget_manwon, tier }: { budget_manwon?: number; tier?: Tier }) => {
        if (budget_manwon != null && !(budget_manwon >= 100 && budget_manwon <= 100000)) throw new Error("예산 범위가 이상해요");
        if (tier && !TIER_ORDER.includes(tier)) throw new Error("없는 등급");
        if (budget_manwon == null && !tier) throw new Error("담을 예산 · 등급이 없어요");
        const labels = [budget_manwon != null ? manwon(Math.round(budget_manwon)) : null, tier ? TIERS[tier] : null].filter(Boolean);
        return propose(labels.join(" · "), () => {
          if (budget_manwon != null) {
            S.budget = Math.round(budget_manwon);
            S.budgetUnknown = false;
            if (!tier && S.tierBy !== "me") S.tier = tierFromBudget();
          }
          if (tier) {
            S.tier = tier;
            S.tierBy = "me";
          }
          if (S.far >= 5) autoPick();
        });
      },
    },
    {
      name: "pick_material",
      execute: ({ material_id }: { material_id: string }) => {
        const m = DATA.materials.find((x) => x.id === material_id);
        if (!m) throw new Error("없는 자재 id");
        return propose(m.name, () => (S.picks[m.cat] = m.id));
      },
    },
    {
      name: "show_step",
      execute: ({ step }: { step: string }) => {
        if (!stepKeys().includes(step)) throw new Error("없는 단계");
        after.step = step;
        return { ok: true };
      },
    },
  ];
}
