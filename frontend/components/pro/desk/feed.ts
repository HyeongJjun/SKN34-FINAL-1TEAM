// 업체 작업 화면 왼쪽 '다른 받은 일': 작업함 할 일 · 공사 탭 첫 쪽을 읽어 재재 칸 목록으로 바꿔요(읽기만).
import { listVendorVisits } from "@/lib/api/vendor";
import { rowHref, rowLabel, rowNext, rowTitle } from "../inbox/rows";
import type { DeskItem } from "./Desk";

export async function deskFeed(current: string, now: string): Promise<DeskItem[]> {
  const [todo, jobs] = await Promise.all([listVendorVisits("todo", "due").catch(() => null), listVendorVisits("jobs", "due").catch(() => null)]);
  const seen = new Set<string>();
  return [...(todo?.items ?? []), ...(jobs?.items ?? [])].flatMap((r) => {
    const key = r.deal_id ?? r.id;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ href: rowHref(r), label: rowLabel(r), title: rowTitle(r), next: rowNext(r, now), on: key === current }];
  });
}
