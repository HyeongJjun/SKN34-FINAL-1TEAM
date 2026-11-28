// /projects/{id} — 한 공사 화면(요약 · 기록 ?tab=log)
// 2026-11-27 사용자: 옛 화면이 나오지 않게 재재 화면(/projects/{id}/assistant)의 같은 창 · 보드 칸으로 보내요.
// 알림 · 메일 · 공유 주소는 그대로 두고 여기서 넘겨요. 남의 공사 · 없는 공사는 재재 화면이 404예요.
import { redirect } from "next/navigation";
import { tradeQuery } from "@/components/secretary/boardLink";

export const metadata = { title: "내 공사" };

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string | string[]; trade?: string | string[] }> }) {
  const [{ id }, { tab, trade }] = await Promise.all([params, searchParams]);
  const log = (Array.isArray(tab) ? tab[0] : tab) === "log";
  // 공정(?trade=)도 넘겨요(공정 탭 공사에서 고른 탭 그대로)
  redirect(`/projects/${encodeURIComponent(id)}/assistant${log ? `?open=log${tradeQuery(trade)}` : tradeQuery(trade, "?")}`);
}
