// 공정 탭 줄 키보드(ui/Tabs와 같은 키): ← → · Home · End로 옆 탭을 고르고 그 탭에 초점을 옮겨요(#234).
// ui/Tabs 모양을 쓰지 않는 탭 줄(위 띠 · 재재 화면 폰 · 원하는 공사)이 같이 써요. 고른 탭만 Tab 키로 들어가요(tabIndex는 부르는 쪽).
import type { KeyboardEvent } from "react";

/** 키 → 옮겨 갈 칸 번호(모르는 키 · 칸이 없으면 -1) */
export function nextTab(i: number, n: number, key: string): number {
  if (n <= 0 || i < 0) return -1;
  if (key === "ArrowRight") return (i + 1) % n;
  if (key === "ArrowLeft") return (i - 1 + n) % n;
  if (key === "Home") return 0;
  if (key === "End") return n - 1;
  return -1;
}

/** role="tablist"의 onKeyDown: 옆 탭을 고르고(pick) 그 탭 단추에 초점 */
export function moveTab<T>(e: KeyboardEvent<HTMLElement>, keys: readonly T[], now: T, pick: (t: T) => void): void {
  const to = nextTab(keys.indexOf(now), keys.length, e.key);
  if (to < 0) return;
  e.preventDefault();
  pick(keys[to]);
  e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')[to]?.focus();
}
