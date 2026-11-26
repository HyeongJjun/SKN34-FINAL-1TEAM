// /projects/{id}/vendors — 업체 보기 · 담기
// 2026-11-26 사용자: 이 화면은 할 게 많고 재재 화면과 모양이 달라서, 재재 화면(/projects/{id}/assistant)의 내 도배 플랜 업체 칸(찾기 · 공정 탭 · 담기)으로 보내요.
// 링크 · 알림 · 공유 주소는 그대로 두고 여기서 넘겨요.
import { redirect } from "next/navigation";

export const metadata = { title: "업체 보기" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/projects/${encodeURIComponent(id)}/assistant?step=2`);
}
