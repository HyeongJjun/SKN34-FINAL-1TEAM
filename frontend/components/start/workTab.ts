// 원하는 공사 공정 탭(목공 · 도배 · 바닥)의 고를 칸 표시와 제출할 때 옮겨 갈 탭(#234). 순수 함수라 pnpm test:unit으로 봐요.
export type WorkTab = "mokgong" | "dobae" | "floor";

/** 오류 칸 → 그 칸이 있는 탭 */
const TAB_OF: Partial<Record<string, WorkTab>> = { mokgong: "mokgong", grade: "dobae", spaces: "dobae", faces: "dobae" };
/** 탭 순서 = 공사 순서(목공 → 도배 → 바닥) */
export const WORK_TABS: readonly WorkTab[] = ["mokgong", "dobae", "floor"];

/** 고를 칸이 남은 탭들. 도배를 끄면 도배 탭(지금은 도배가 꼭 들어가요) */
export function badTabs(errorKeys: readonly string[], dobaeOn: boolean): Set<WorkTab> {
  const bad = new Set<WorkTab>();
  for (const k of errorKeys) { const t = TAB_OF[k]; if (t) bad.add(t); }
  if (!dobaeOn) bad.add("dobae");
  return bad;
}

/** 제출할 때 보여 줄 탭: 보고 있는 탭에 고를 칸이 있으면 그대로, 아니면 공사 순서대로 첫 탭. 없으면 null */
export function errorTab(errorKeys: readonly string[], dobaeOn: boolean, now: WorkTab): WorkTab | null {
  const bad = badTabs(errorKeys, dobaeOn);
  if (bad.has(now)) return now;
  return WORK_TABS.find((t) => bad.has(t)) ?? null;
}
