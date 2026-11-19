// 서버 쪽 읽기: 공정표 · 업체 확정 · 공사 날짜 · 한 공사 화면 · 기록 · 실측 견적서 비교 · 서류.
// 예시 데이터(NEXT_PUBLIC_MJ_MOCK=1, 개발에서만)면 B2b 화면이 읽는 것(공사 날짜 · 한 공사 화면 · 기록 · 비교)만 lib/mock/v3b를 읽어요.
import { serverGet, type Schemas } from "@/lib/backend/server";
import { MOCK_V3B } from "@/lib/mock/v3b/mode";
import { mockProjectIds, mockStep } from "@/lib/mock/v3b/server";
import { mockCompare, mockLog, mockMyProjects, mockOverview, mockSchedule } from "@/lib/mock/v3b/story";
import { isUuid } from "./project";

const seg = encodeURIComponent;

export type ApiPlan = Schemas["PlanOut"];
/** 공정표(믿집 계산). 남의 것이면 null. kind를 비우면 수락한 날짜가 있을 때 확정 공정표, 없으면 예상 공정표 */
export async function getPlan(projectId: string, kind?: "expected" | "final") {
  return isUuid(projectId) ? serverGet<ApiPlan>(`/projects/${seg(projectId)}/plan${kind ? `?kind=${kind}` : ""}`) : null;
}

export type ApiDeal = Schemas["DealOut"];
/** 이 집 공정의 업체 확정(다시 고른 것은 빠짐). 남의 공사면 null */
export async function listDeals(projectId: string, trade?: "dobae" | "mokgong") {
  return isUuid(projectId) ? serverGet<ApiDeal[]>(`/projects/${seg(projectId)}/deals${trade ? `?trade=${trade}` : ""}`) : null;
}

export type ApiSchedule = Schemas["ScheduleOut"];
/** 고객: 공정별 공사 날짜(업체가 낸 날 · 다른 날짜 요청 · 남은 요청 수 · 기한) · 추가 금액 · 공사 끝. 남의 공사면 null */
export async function getSchedule(projectId: string): Promise<ApiSchedule | null> {
  if (!isUuid(projectId)) return null;
  if (MOCK_V3B) return mockSchedule(await mockStep(), projectId);
  return serverGet<ApiSchedule>(`/projects/${seg(projectId)}/schedule`);
}

export type ApiJob = Schemas["JobOut"];
/** 업체: 공사 날짜 내기 화면 값(내 확정만, 아니면 null) */
export async function getVendorJob(dealId: string) {
  return isUuid(dealId) ? serverGet<ApiJob>(`/vendor/jobs/${seg(dealId)}`) : null;
}

export type ApiOverview = Schemas["OverviewOut"];
/** 고객: 한 공사 화면(지금 할 일 · 공정별 단계 · 실측 뒤 작은 단계 · 업체 · 낼 금액 · 공사 기간). 남의 공사면 null */
export async function getOverview(projectId: string): Promise<ApiOverview | null> {
  if (!isUuid(projectId)) return null;
  if (MOCK_V3B) return mockOverview(await mockStep(), projectId);
  return serverGet<ApiOverview>(`/projects/${seg(projectId)}/overview`);
}

export type ApiLogItem = Schemas["LogItemOut"];
/** 고객: 한 공사 기록(C63 · I2). 실측 일정 · 견적서 · 공사 이력을 시간 순으로. 남의 공사면 null */
export async function getProjectLog(projectId: string): Promise<ApiLogItem[] | null> {
  if (!isUuid(projectId)) return null;
  if (MOCK_V3B) return mockLog(await mockStep());
  return serverGet<ApiLogItem[]>(`/projects/${seg(projectId)}/log`);
}

export type ApiCompare = Schemas["CompareDealOut"];
/** 고객: 실측 견적서 비교(C33 · D18 · C34). 합계 · 차이 · 유효기간 지남은 계산 엔진 값. 남의 공사면 null.
 *  (lib/api/quote.ts의 getQuoteCompare와 같은 API예요. B2b 화면은 예시 데이터를 읽으려고 이 함수를 써요) */
export async function getCompare(projectId: string, trade: "dobae" | "mokgong" = "dobae"): Promise<ApiCompare | null> {
  if (!isUuid(projectId)) return null;
  if (MOCK_V3B) return mockCompare(await mockStep(), projectId);
  return serverGet<ApiCompare>(`/projects/${seg(projectId)}/quotes?trade=${trade}`);
}

export type ApiMyProject = Schemas["MyProjectOut"];
/** 고객: 내 공사 목록 v3(C42 · D09): 단계 띠 6칸 · 지금 할 일 · 업체별 다음 할 일 · 기한. 최근 순
 *  (lib/api/project.ts의 listMyProjects와 같은 API예요. B2b 화면은 예시 데이터를 읽으려고 이 함수를 써요) */
export async function listMyProjectsV3(): Promise<ApiMyProject[]> {
  if (MOCK_V3B) return mockMyProjects(await mockStep(), await mockProjectIds());
  return (await serverGet<ApiMyProject[]>("/projects")) ?? [];
}

export type ApiDocs = Schemas["DocsOut"];
/** 고객: 서류 모음(표준견적서 · 공정표 버전 · 실측 견적서 · 추가 금액). 남의 공사면 null */
export async function getDocs(projectId: string) {
  return isUuid(projectId) ? serverGet<ApiDocs>(`/projects/${seg(projectId)}/docs`) : null;
}
