// /projects/{id}/quotes — 실측 견적서 비교
// 2026-11-26 사용자: 옆에 옛날 AI 채팅 칸이 남아 있어서, 재재 화면(/projects/{id}/assistant)의 내 도배 플랜 비교 칸(표준견적서와 견주고 확정)으로 보내요.
// 알림 · 메일 링크 주소는 그대로 두고 여기서 넘겨요. 남의 공사 · 없는 공사는 재재 화면이 404예요.
import { redirect } from "next/navigation";

export const metadata = { title: "실측 견적서" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/projects/${encodeURIComponent(id)}/assistant?step=4`);
}
