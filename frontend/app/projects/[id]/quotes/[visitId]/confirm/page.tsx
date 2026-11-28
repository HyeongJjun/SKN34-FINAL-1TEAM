// /projects/{id}/quotes/{visitId}/confirm — 실측 견적서 확정
// 2026-11-27 사용자: 옛 화면이 나오지 않게 재재 화면(/projects/{id}/assistant)의 같은 창 · 보드 칸으로 보내요.
// 알림 · 메일 · 공유 주소는 그대로 두고 여기서 넘겨요. 남의 공사 · 없는 공사는 재재 화면이 404예요.
import { redirect } from "next/navigation";

export const metadata = { title: "업체 확정" };

export default async function Page({ params }: { params: Promise<{ id: string; visitId: string }> }) {
  const { id } = await params;
  redirect(`/projects/${encodeURIComponent(id)}/assistant?step=4`);
}
