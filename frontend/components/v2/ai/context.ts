// AI에 넘기는 고객 상태와 자재 자료 (v10 contextText). 지시문은 서버가 만든다. 여기서는 데이터만 모은다.
// 자재는 질문 · 고른 범위와 가까운 것만 골라 보낸다(전체 자료를 보내면 지시문이 4만 자가 넘는다).
import { CAT, priceText, TIERS } from "../data";
import { scopeCats, styleOf } from "../flow";
import { DATA, S } from "../store";

const MAX_MATERIALS = 18;

export function profileOf() {
  const st = styleOf(S.style);
  const picks = Object.entries(S.picks)
    .map(([c, id]) => {
      const m = DATA.materials.find((x) => x.id === id);
      return m ? `${CAT[c]?.ko}: ${m.brand} ${m.name} (${TIERS[m.tier]}, ${priceText(m.price)})`.slice(0, 200) : null;
    })
    .filter((x): x is string => !!x);
  return {
    style: st ? st.ko : "",
    pyeong: S.info.pyeong,
    region: S.info.region,
    living: S.info.living === "living" ? "살면서 공사" : S.info.living === "vacant" ? "빈집" : "",
    scope: S.scope.kind === "part" ? S.scope.cats.map((c) => CAT[c]?.ko).join(", ") : S.scope.kind === "all" ? "집 전체" : "",
    budget_manwon: S.budget,
    tier: TIERS[S.tier],
    step: S.step,
    picks,
    photos: S.photos.length,
    ref_photos: S.refs.length,
    plan_name: S.plan?.name || "",
  };
}

/** 질문과 가까운 자재: 고른 자재 → 질문에 나온 이름 · 브랜드 · 종류 → 범위 안 순위 순 */
export function materialsFor(q: string) {
  const inScope = new Set(scopeCats().map((c) => c.id));
  const picked = new Set(Object.values(S.picks));
  const text = String(q || "");
  const score = (m: (typeof DATA.materials)[number]) => {
    let s = 0;
    if (picked.has(m.id)) s += 1000;
    if (text.includes(m.name) || (m.brand && text.includes(m.brand))) s += 500;
    if (CAT[m.cat]?.ko && text.includes(CAT[m.cat].ko)) s += 200;
    if (m.tier === S.tier) s += 20;
    return s - (m.rank || 50);
  };
  return DATA.materials
    .filter((m) => inScope.has(m.cat) || picked.has(m.id))
    .map((m) => [score(m), m] as const)
    .sort((a, b) => b[0] - a[0])
    .slice(0, MAX_MATERIALS)
    .map(([, m]) => ({
      id: m.id,
      cat: CAT[m.cat]?.ko || m.cat,
      tier: TIERS[m.tier] || m.tier,
      rank: m.rank || null,
      brand: (m.brand || "").slice(0, 200),
      name: m.name.slice(0, 200),
      spec: (m.spec || "").slice(0, 70),
      price: priceText(m.price).slice(0, 200),
      tags: (m.tags || []).slice(0, 8).map((t) => String(t).slice(0, 20)),
    }));
}
