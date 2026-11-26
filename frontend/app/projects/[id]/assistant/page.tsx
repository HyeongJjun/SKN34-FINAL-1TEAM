// /projects/{id}/assistant — 재재 비서 화면(시연 영상 11~48장면): 위 칩 · 왼쪽 대화(지금 단계 카드) · 오른쪽 내 도배 플랜.
// 읽기: overview · quotes(비교) · schedule · visits · vendors · visits/draft · 표준견적서(창). 쓰기는 오른쪽 보드 단추가 기존 API를 불러요(ProjectFlow 머리 주석).
// ?open=standard(인테리어 받기에서 만든 바로 뒤)면 표준견적서 창을 열고 시작해요.
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/site/AppHeader";
import { LiveRefresh } from "@/components/schedule/LiveRefresh";
import { ProjectFlow } from "@/components/secretary/ProjectFlow";
import { getProjectShell } from "@/lib/api/project";
import { getMyMarketQuote, getStandardView } from "@/lib/api/quote";
import { getCompare, getOverview, getSchedule } from "@/lib/api/schedule";
import { getVisitDraft, getVisitProject, listProjectVendors, listProjectVisits } from "@/lib/api/visit";
import { todaySeoul } from "@/lib/format";
import { requireRole } from "@/lib/session";

export const metadata = { title: "재재와 진행하기" };

export default async function SecretaryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ open?: string; step?: string }> }) {
  const [{ id }, { open, step }] = await Promise.all([params, searchParams]);
  // ?step=2(업체) · 3(실측): 업체 보기 · 실측 요청 화면에서 넘어와 그 보드 칸을 열어요
  const board = step && /^[0-7]$/.test(step) ? Number(step) : null;
  await requireRole("customer", `/projects/${encodeURIComponent(id)}/assistant`);
  const [p, ov] = await Promise.all([getVisitProject(id), getOverview(id)]);
  if (!p || !ov) notFound();
  const safe = <T,>(x: Promise<T>) => x.catch(() => null);
  const [compare, schedule, visits, vendors, draft, shell, market, mokVendors] = await Promise.all([
    safe(getCompare(p.id)), safe(getSchedule(p.id)), safe(listProjectVisits(p.id, "dobae")), safe(listProjectVendors(p.id, "dobae")), safe(getVisitDraft(p.id, "dobae")),
    safe(getProjectShell(p.id)), safe(getMyMarketQuote(p.id)), safe(listProjectVendors(p.id, "mokgong")), // 목공을 고르지 않은 공사는 null
  ]);
  // 표준견적서 창: 내 공사 표준견적서 화면과 같은 값(전체 도배는 시장 단가, 아니면 공공 기준)
  const view = shell ? await safe(getStandardView(shell)) : null;
  const std = view ? { view, market: shell?.mock ? null : market } : null;
  return (
    <>
      <AppHeader only="phone" phone={{ title: "재재와 진행하기", back: `/projects/${encodeURIComponent(p.id)}` }} />
      <ProjectFlow data={{ p, ov, compare, schedule, visits, vendors, mokVendors, draft, today: todaySeoul(), std, openStd: open === "standard", step: board }} />
      <LiveRefresh projectId={p.id} />
    </>
  );
}
