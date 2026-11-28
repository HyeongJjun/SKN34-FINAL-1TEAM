// /projects/{id}/quotes — 실측 견적서 비교
// 2026-11-26 사용자: 옆에 옛날 AI 채팅 칸이 남아 있어서, 재재 화면(/projects/{id}/assistant)의 내 도배 플랜 비교 칸(표준견적서와 견주고 확정)으로 보내요.
// 알림 · 메일 링크 주소는 그대로 두고 여기서 넘겨요. 남의 공사 · 없는 공사는 재재 화면이 404예요.
import { redirect } from "next/navigation";
import { tradeQuery } from "@/components/secretary/boardLink";

export const metadata = { title: "실측 견적서" };

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ trade?: string | string[] }> }) {
  const { id } = await params;
  // 공정(?trade=)을 그대로 넘겨 그 공정 탭 보드로 가요(#234 리뷰)
  const t = tradeQuery((await searchParams).trade);
  // 목공 견적서 비교 · 확정은 아직 도배만이라(#206) 목공은 실측 칸으로 가요(4칸은 준비 중 안내뿐)
  redirect(`/projects/${encodeURIComponent(id)}/assistant?step=${t.includes("mokgong") ? 3 : 4}${t}`);
}
