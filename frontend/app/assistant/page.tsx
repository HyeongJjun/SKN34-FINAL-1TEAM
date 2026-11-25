// /assistant — 재재 비서 화면 시작(시연 영상 1~10장면): 위 칩 · 왼쪽 대화 · 오른쪽 내 도배 플랜.
// 손님도 열 수 있어요(서버 AI 없이 규칙으로 집 정보를 채우고 POST /guest/standard로 표준견적서). 업체부터는 공사 화면(/projects/{id}/assistant)으로 이어가요.
// 진행 중인 공사가 있는 고객은 그 공사의 비서 화면으로 바로 가요. 공사가 없으면 /start(기본 정보, 채팅 없음)로 보내요(2026-11-25 회의).
import { redirect } from "next/navigation";
import { listMyProjects } from "@/lib/api/project";
import { getSession } from "@/lib/session";

export const metadata = { title: "재재와 시작하기" };

export default async function AssistantStart({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const { new: fresh } = await searchParams;
  const session = await getSession();
  const member = session?.role === "customer";
  if (member && !fresh) {
    const going = (await listMyProjects().catch(() => [])).find((p) => p.phase !== "done");
    if (going) redirect(`/projects/${encodeURIComponent(going.id)}/assistant`);
  }
  // 2026-11-25 회의: 채팅은 기본 정보를 받은 뒤 시작해요. 공사가 없으면 기본 정보 화면(채팅 없음)으로 보내요
  redirect("/start");
}
