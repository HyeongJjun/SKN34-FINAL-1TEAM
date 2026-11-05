// 서버 쪽 읽기: 실측. 이 집 업체 목록 · 업체 자세히 · 실측 요청(고객), 작업함 · 요청 자세히(업체)는 실제 API.
import { serverGet, type Schemas } from "@/lib/backend/server";

export type VisitTrade = "dobae" | "mokgong";
const UUID = /^[0-9a-f-]{36}$/i;

// 고객
export type ProjectVendors = Schemas["VendorListOut"];
export type ProjectVendorDetail = Schemas["VendorDetailOut"];
export type ProjectVisits = Schemas["VisitListOut"];
/** 이 집 공정의 업체 목록(가견적 낮은 순). 남의 공사 · 고르지 않은 공정이면 null */
export async function listProjectVendors(projectId: string, trade: VisitTrade) {
  return UUID.test(projectId) ? serverGet<ProjectVendors>(`/projects/${projectId}/vendors?trade=${trade}&sort=estimate`) : null;
}
/** 업체 자세히(이 집 가견적 계산 줄 포함). 목록 밖 업체면 null */
export async function getProjectVendor(projectId: string, vendorId: string, trade: VisitTrade) {
  return UUID.test(projectId) && UUID.test(vendorId)
    ? serverGet<ProjectVendorDetail>(`/projects/${projectId}/vendors/${vendorId}?trade=${trade}`)
    : null;
}
/** 이 집 실측 요청 목록 · 연락할 때 보낼 문구 · 남은 칸 */
export async function listProjectVisits(projectId: string, trade?: VisitTrade) {
  return UUID.test(projectId) ? serverGet<ProjectVisits>(`/projects/${projectId}/visits${trade ? `?trade=${trade}` : ""}`) : null;
}

// 업체
export type InboxTab = "todo" | "waiting" | "jobs" | "done";
export type InboxPage = Schemas["InboxPageOut"];
export type InboxSummary = Schemas["InboxSummaryOut"];
export type VendorVisitDetail = Schemas["VendorVisitDetailOut"];
/** 작업함 한 탭(끝남은 before 커서로 이어 받기) */
export async function listInbox(tab: InboxTab, before?: string) {
  const qs = new URLSearchParams({ tab });
  if (before) qs.set("before", before);
  return serverGet<InboxPage>(`/vendor/visits?${qs.toString()}`);
}
export async function getInboxSummary() { return serverGet<InboxSummary>("/vendor/visits/summary"); }
/** 요청 자세히(내 요청이 아니면 null) */
export async function getVendorVisit(visitId: string) {
  return UUID.test(visitId) ? serverGet<VendorVisitDetail>(`/vendor/visits/${visitId}`) : null;
}
