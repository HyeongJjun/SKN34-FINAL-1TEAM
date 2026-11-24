// /assistant — 재재 비서 화면 시작(시연 영상 1~10장면): 위 칩 · 왼쪽 대화 · 오른쪽 내 도배 플랜.
// 손님도 열 수 있어요(서버 AI 없이 규칙으로 집 정보를 채우고 POST /guest/standard로 표준견적서). 업체부터는 공사 화면(/projects/{id}/assistant)으로 이어가요.
// 진행 중인 공사가 있는 고객은 그 공사의 비서 화면으로 바로 가요.
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/site/AppHeader";
import { StartFlow } from "@/components/secretary/StartFlow";
import { getRegions, listMyProjects } from "@/lib/api/project";
import { todaySeoul } from "@/lib/format";
import { MOCK_V3A } from "@/lib/mock/v3a/mode";
import { getSession } from "@/lib/session";

export const metadata = { title: "재재와 시작하기" };

export default async function AssistantStart({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const { new: fresh } = await searchParams;
  const [session, regions] = await Promise.all([getSession(), getRegions()]);
  const member = session?.role === "customer";
  if (member && !fresh) {
    const going = (await listMyProjects().catch(() => [])).find((p) => p.phase !== "done");
    if (going) redirect(`/projects/${encodeURIComponent(going.id)}/assistant`);
  }
  return (
    <>
      <AppHeader phone={{ title: "재재와 시작하기", back: "/" }} />
      <StartFlow regions={regions} today={todaySeoul()} member={member} mock={MOCK_V3A} />
    </>
  );
}
