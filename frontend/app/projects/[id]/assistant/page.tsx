// /projects/{id}/assistant — 재재 비서 화면(시연 영상 11~48장면): 왼쪽 대화(지금 단계 카드) · 오른쪽 내 도배 플랜.
// 읽기: overview · quotes(비교) · schedule · visits · vendors · visits/draft · 표준견적서(창). 쓰기는 오른쪽 보드 단추가 기존 API를 불러요(ProjectFlow 머리 주석).
// ?open=standard(인테리어 받기에서 만든 바로 뒤)면 표준견적서 창을 열고 시작해요.
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/site/AppHeader";
import { LiveRefresh } from "@/components/schedule/LiveRefresh";
import { cameFrom } from "@/components/secretary/boardLink";
import { ProjectFlow } from "@/components/secretary/ProjectFlow";
import { getChecks, getPlanView, getProjectShell, getRegions } from "@/lib/api/project";
import { fromSaved } from "@/lib/guest/info";
import { getMyMarketQuote, getMyMarketQuotes, getStandardView } from "@/lib/api/quote";
import { getCompare, getOverview, getSchedule } from "@/lib/api/schedule";
import { getVisitDraft, getVisitProject, listProjectVendors, listProjectVisits } from "@/lib/api/visit";
import { todaySeoul } from "@/lib/format";
import { requireRole } from "@/lib/session";

export const metadata = { title: "재재와 진행하기" };

export default async function SecretaryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ id }, q] = await Promise.all([params, searchParams]);
  // 옛 화면 · 다른 화면에서 넘어온 보드 칸 · 창 · 업체 창(#236). 읽는 값과 ProjectFlow가 지우는 값은 boardLink.CAME_KEYS 하나예요
  const { step: board, openWin, scheduleView, openVendor, openStd } = cameFrom(q);
  await requireRole("customer", `/projects/${encodeURIComponent(id)}/assistant`);
  const [p, ov] = await Promise.all([getVisitProject(id), getOverview(id)]);
  if (!p || !ov) notFound();
  const safe = <T,>(x: Promise<T>) => x.catch(() => null);
  // 실측은 도배 · 목공 둘 다 읽어요(팀 피드백 5). 목공 초안은 목공을 고른 공사만 있어요(아니면 null)
  const [compare, schedule, visits, vendors, draft, shell, market, mokVendors, mokDraft, regions, plan, checks, parts] = await Promise.all([
    safe(getCompare(p.id)), safe(getSchedule(p.id)), safe(listProjectVisits(p.id)), safe(listProjectVendors(p.id, "dobae")), safe(getVisitDraft(p.id, "dobae")),
    safe(getProjectShell(p.id)), safe(getMyMarketQuote(p.id)), safe(listProjectVendors(p.id, "mokgong")), safe(getVisitDraft(p.id, "mokgong")), // 목공을 고르지 않은 공사는 null
    // 재재 화면 창(기본 정보 고치기 · 공정표)에 쓰는 값
    getRegions().catch(() => []), safe(getPlanView(p.id)), getChecks(p.id).catch(() => []),
    safe(getMyMarketQuotes(p.id)), // 공정 탭: 공정마다 따로 계산한 표준견적서와 합계
  ]);
  // 표준견적서 창: 내 공사 표준견적서 화면과 같은 값(전체 도배는 시장 단가, 아니면 공공 기준)
  const view = shell ? await safe(getStandardView(shell)) : null;
  // 표준견적서는 업체 견적서 시장 단가(#207). 목공을 고른 공사는 서버가 목공도 켜서 줘요. 부분 공사처럼 없으면 기존 표준견적서
  const std = view ? { view, market: shell?.mock ? null : market, parts: shell?.mock ? null : parts } : null;
  return (
    <>
      <AppHeader only="phone" phone={{ title: "재재와 진행하기", back: "/my" }} />
      <ProjectFlow data={{ p, ov, compare, schedule, visits, vendors, mokVendors, draft, mokDraft, today: todaySeoul(), std, openStd, step: board, openWin, scheduleView, openVendor,
        win: { regions, draft: shell?.home ? fromSaved(shell.home) : null, plan, checks } }} />
      <LiveRefresh projectId={p.id} />
    </>
  );
}
