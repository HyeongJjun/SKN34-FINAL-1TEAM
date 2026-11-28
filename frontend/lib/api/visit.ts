// 서버 쪽 읽기: 실측. 이 집 업체 목록 · 업체 자세히(고객), 작업함 · 요청 자세히(업체)는 지금 그대로 실제 API.
// v3 실측 일정(B2b): 상태판 · 날짜 고르기 · 요청서 초안 · 화면 머리의 공사 요약.
// 예시 데이터(NEXT_PUBLIC_MJ_MOCK=1, 개발에서만)면 lib/mock/v3b를 읽어요. 예시 ↔ 실제는 이 파일 안에서만 바꿔요.
import { serverGet, type Schemas } from "@/lib/backend/server";
import { dateSeoul, todaySeoul } from "@/lib/format";
import { tradeLabel } from "@/lib/labels";
import { MOCK_V3B, STEPS } from "@/lib/mock/v3b/mode";
import { mockStep } from "@/lib/mock/v3b/server";
import { MOCK_PROJECT, mockBoard, mockDraft, mockPick } from "@/lib/mock/v3b/story";
import { getMyProject } from "./project";

export type VisitTrade = "dobae" | "mokgong";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const seg = encodeURIComponent;

// 고객
export type ProjectVendors = Schemas["VendorListOut"];
export type ProjectVendorDetail = Schemas["VendorDetailOut"];
export type ProjectVisits = Schemas["VisitListOut"];
/** 이 집 공정의 업체 목록(가견적 낮은 순). 남의 공사 · 고르지 않은 공정이면 null */
export async function listProjectVendors(projectId: string, trade: VisitTrade) {
  return UUID.test(projectId) ? serverGet<ProjectVendors>(`/projects/${seg(projectId)}/vendors?trade=${trade}&sort=estimate`) : null;
}
/** 업체 자세히(이 집 가견적 계산 줄 포함). 목록 밖 업체면 null */
export async function getProjectVendor(projectId: string, vendorId: string, trade: VisitTrade) {
  return UUID.test(projectId) && UUID.test(vendorId)
    ? serverGet<ProjectVendorDetail>(`/projects/${seg(projectId)}/vendors/${seg(vendorId)}?trade=${trade}`)
    : null;
}
/** 이 집 실측 요청 목록 · 연락할 때 보낼 문구 · 남은 칸 */
export async function listProjectVisits(projectId: string, trade?: VisitTrade) {
  return UUID.test(projectId) ? serverGet<ProjectVisits>(`/projects/${seg(projectId)}/visits${trade ? `?trade=${trade}` : ""}`) : null;
}

// ───── v3 실측 일정(고객, B2b) ─────
export type VisitBoard = Schemas["VisitListOut"];
export type BoardRow = Schemas["BoardRowOut"];
export type VisitPick = Schemas["VisitPickOut"];
export type VisitDraft = Schemas["VisitDraftOut"];

/** 실측 일정 상태판(C14 · D03): 요청 머리 + 업체별 상태 · 다음 할 일 · 기한. 공정이 없으면 이 공사 모든 공정. 남의 공사면 null */
export async function getVisitBoard(projectId: string, trade?: VisitTrade): Promise<VisitBoard | null> {
  if (!UUID.test(projectId)) return null;
  if (MOCK_V3B) return mockBoard(await mockStep(), projectId);
  return serverGet<VisitBoard>(`/projects/${seg(projectId)}/visits${trade ? `?trade=${trade}` : ""}`);
}

/** 날짜 고르기(C16 · C19 · C21 · C22 · D15~D17): 내 희망 · 업체 기간 · 열린 반나절 · 마감 · 내 다른 실측 · 추천. 남의 것이면 null */
export async function getVisitPick(projectId: string, visitId: string): Promise<VisitPick | null> {
  if (!UUID.test(projectId) || !UUID.test(visitId)) return null;
  if (MOCK_V3B) return mockPick(await mockStep(), projectId, visitId);
  return serverGet<VisitPick>(`/projects/${seg(projectId)}/visits/${seg(visitId)}`);
}

/** 요청서 초안(C13 · D08): 희망 기간(공사 시작 − 28일 ~ − 14일, 계산 엔진) · 담은 업체 가견적 */
export async function getVisitDraft(projectId: string, trade: VisitTrade = "dobae"): Promise<VisitDraft | null> {
  if (!UUID.test(projectId)) return null;
  if (MOCK_V3B) return mockDraft(await mockStep());
  return serverGet<VisitDraft>(`/projects/${seg(projectId)}/visits/draft?trade=${trade}`);
}

/** 달력의 '오늘'(서울 날짜). 화면 조각은 시계를 읽지 않고 이 값을 받아요. 예시 데이터면 그 단계의 날짜예요 */
export async function visitToday(): Promise<string> {
  if (MOCK_V3B) {
    const step = await mockStep();
    return dateSeoul(STEPS.find((s) => s.key === step)?.at ?? STEPS[0].at);
  }
  return todaySeoul();
}

/** 화면 머리 · 요청 내용에 쓰는 공사 요약. 공사 이름은 '상계동 아파트 도배'(동네 + 아파트 + 공사 종류, copy-guide 1.1) */
export type VisitProject = {
  id: string;
  name: string;
  sgg: string;
  emd: string | null;
  areaM2: string | null;
  areaBasis: string | null;
  scope: "full" | "partial" | null;
  occupied: boolean;
  grade: "economy" | "basic" | null;
  budgetWon: number | null;
  startDate: string | null;
  locked: boolean;
};
export async function getVisitProject(projectId: string): Promise<VisitProject | null> {
  if (!UUID.test(projectId)) return null;
  if (MOCK_V3B) {
    const p = MOCK_PROJECT;
    return { id: projectId, name: p.name, sgg: p.sgg, emd: p.emd, areaM2: p.area_m2, areaBasis: p.area_basis, scope: p.scope, occupied: p.occupied, grade: p.grade, budgetWon: p.budget_won, startDate: p.start_date, locked: true };
  }
  const p = await getMyProject(projectId);
  if (!p) return null;
  const h = p.home ?? null;
  const trade = h?.trade ?? (p.trades.dobae ? "dobae" : "mokgong");
  const emd = h?.emd ?? p.emd ?? null;
  return {
    id: p.id,
    name: `${emd ?? p.sgg} 아파트 ${tradeLabel(trade)}`,
    sgg: h?.sgg ?? p.sgg,
    emd,
    areaM2: h?.area_m2 ?? p.size.m2 ?? null,
    areaBasis: h?.area_basis ?? p.size.basis ?? null,
    scope: h?.scope ?? null,
    occupied: h?.occupied ?? p.occupied,
    grade: h?.grade ?? p.trades.dobae?.grade ?? null,
    budgetWon: h?.budget_won ?? p.budget_won ?? null,
    startDate: h?.start_date ?? p.when.start ?? null,
    locked: p.locked,
  };
}

// 업체
export type InboxTab = "todo" | "waiting" | "jobs" | "done";
/** v3 작업함 탭(일정 탭 sched 더함, api.md 6장) */
export type InboxTabV3 = InboxTab | "sched";
export type InboxPage = Schemas["InboxPageOut"];
export type InboxSummary = Schemas["InboxSummaryOut"];
export type VendorVisitDetail = Schemas["VendorVisitDetailOut"];
/** 작업함 한 탭(끝남은 before 커서로 이어 받기) */
export async function listInbox(tab: InboxTabV3, before?: string) {
  const qs = new URLSearchParams({ tab });
  if (before) qs.set("before", before);
  return serverGet<InboxPage>(`/vendor/visits?${qs.toString()}`);
}
export async function getInboxSummary() { return serverGet<InboxSummary>("/vendor/visits/summary"); }
/** 요청 자세히(내 요청이 아니면 null). 업체 채팅 띠(V09 · V20)도 이 값을 써요 */
export async function getVendorVisit(visitId: string) {
  return UUID.test(visitId) ? serverGet<VendorVisitDetail>(`/vendor/visits/${seg(visitId)}`) : null;
}
