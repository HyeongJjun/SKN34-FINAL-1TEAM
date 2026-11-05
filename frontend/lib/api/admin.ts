// 서버 쪽 읽기: 관리자. 업체 가입 신청은 실제 API, 회원 목록은 예시 데이터.
import { serverGet, type Schemas } from "@/lib/backend/server";
import { MEMBERS } from "@/lib/mock/data";

export async function listMembers() { return MEMBERS; }

export type VendorApplication = Schemas["VendorAdminOut"];
export type VendorApplicationDetail = Schemas["VendorAdminDetailOut"];
export type ReviewSummary = Schemas["ReviewSummaryOut"];
/** 심사 목록 탭: 기다림 · 보완 요청 · 처리함(승인 · 거절) */
export type ReviewTab = "pending" | "needs_info" | "done";
export async function listVendorApplications(status?: ReviewTab, q?: string) {
  const qs = new URLSearchParams();
  if (status) qs.set("status", status);
  if (q?.trim()) qs.set("q", q.trim());
  const s = qs.toString();
  return (await serverGet<VendorApplication[]>(`/admin/vendors${s ? `?${s}` : ""}`)) ?? [];
}
export async function getReviewSummary() { return serverGet<ReviewSummary>("/admin/vendors/summary"); }
export async function getVendorApplication(id: string) {
  return /^[0-9a-f-]{36}$/i.test(id) ? serverGet<VendorApplicationDetail>(`/admin/vendors/${id}`) : null;
}
