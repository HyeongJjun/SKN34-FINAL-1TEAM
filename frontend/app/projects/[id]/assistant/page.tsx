// /projects/{id}/assistant — 재재 비서 화면(시연 영상 11~48장면): 위 칩 · 왼쪽 대화(지금 단계 카드) · 오른쪽 내 도배 플랜.
// 읽기: overview · quotes(비교) · schedule · visits · vendors · visits/draft. 쓰기는 카드 단추가 기존 API를 불러요(ProjectFlow 머리 주석).
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/site/AppHeader";
import { LiveRefresh } from "@/components/schedule/LiveRefresh";
import { ProjectFlow } from "@/components/secretary/ProjectFlow";
import { getCompare, getOverview, getSchedule } from "@/lib/api/schedule";
import { getVisitDraft, getVisitProject, listProjectVendors, listProjectVisits } from "@/lib/api/visit";
import { todaySeoul } from "@/lib/format";
import { requireRole } from "@/lib/session";

export const metadata = { title: "재재와 진행하기" };

export default async function SecretaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRole("customer", `/projects/${encodeURIComponent(id)}/assistant`);
  const [p, ov] = await Promise.all([getVisitProject(id), getOverview(id)]);
  if (!p || !ov) notFound();
  const safe = <T,>(x: Promise<T>) => x.catch(() => null);
  const [compare, schedule, visits, vendors, draft] = await Promise.all([
    safe(getCompare(p.id)), safe(getSchedule(p.id)), safe(listProjectVisits(p.id, "dobae")), safe(listProjectVendors(p.id, "dobae")), safe(getVisitDraft(p.id, "dobae")),
  ]);
  return (
    <>
      <AppHeader only="phone" phone={{ title: "재재와 진행하기", back: `/projects/${encodeURIComponent(p.id)}` }} />
      <ProjectFlow data={{ p, ov, compare, schedule, visits, vendors, draft, today: todaySeoul() }} />
      <LiveRefresh projectId={p.id} />
    </>
  );
}
