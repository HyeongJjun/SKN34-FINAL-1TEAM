// 서버 쪽 읽기: 관리자(업체 심사 · 신고 · 링크 · 회원). 예시 데이터 모드면 lib/mock/v3c/admin.ts를 돌려줘요(이 파일 안에서만 바꿔요).
import { serverGet, type Schemas as S } from "@/lib/backend/server";
import * as M from "@/lib/mock/v3c/admin";
import { MOCK } from "@/lib/mock/v3c/mode";
import { MOCK_ADMIN } from "@/lib/mock/v3c/session";
import { getSession, requireRole } from "@/lib/session";
import type { Session } from "@/lib/types";

export type VendorApplication = S["VendorAdminOut"];
export type VendorApplicationDetail = S["VendorAdminDetailOut"];
export type ReviewSummary = S["ReviewSummaryOut"];
/** 심사 목록 거르기: 전체(all) · 기다림 · 보완 요청 · 처리함(승인 · 거절) */
export type ReviewTab = "all" | "pending" | "needs_info" | "done";
export type ReportRowV3 = S["ReportRowOut"];
export type AdminReportPage = Omit<S["ReportPageOut"], "items"> & { items: ReportRowV3[] };
/** reporter_label(이름 없이 '수유동 고객') · link_label · link_url(링크 신고 대상)은 B1b가 채워요 */
export type AdminReportDetail = S["ReportDetailOut"];
export type AdminMembersPage = S["MemberPageOut"];
export type MemberRow = S["MemberRowOut"];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const enc = encodeURIComponent;

/** 관리자만. 예시 모드에서 진짜 관리자 세션이 없으면 예시 관리자로 봐요 */
export async function adminGate(next: string): Promise<Session> {
  if (MOCK) {
    const s = await getSession();
    return s?.role === "admin" ? s : MOCK_ADMIN;
  }
  return requireRole("admin", next);
}

// ───── 업체 심사 (A01 · A04) ─────
export async function listVendorApplications(status: ReviewTab = "all", q?: string): Promise<VendorApplication[]> {
  if (MOCK) {
    const done = (s: string) => s === "approved" || s === "rejected";
    return M.MOCK_ADMIN_VENDORS.filter((v) => status === "all" || (status === "done" ? done(v.status) : v.status === status));
  }
  const qs = new URLSearchParams();
  if (status !== "all") qs.set("status", status);
  if (q?.trim()) qs.set("q", q.trim());
  const s = qs.toString();
  return (await serverGet<VendorApplication[]>(`/admin/vendors${s ? `?${s}` : ""}`)) ?? [];
}
export async function getReviewSummary(): Promise<ReviewSummary | null> {
  if (MOCK) return { pending: 1, needs_info: 1, done: 1 };
  return serverGet<ReviewSummary>("/admin/vendors/summary");
}
export async function getVendorApplication(id: string): Promise<VendorApplicationDetail | null> {
  if (!UUID.test(id)) return null;
  if (MOCK) return M.MOCK_ADMIN_DETAIL[id] ?? null;
  return serverGet<VendorApplicationDetail>(`/admin/vendors/${enc(id)}`);
}

// ───── 신고 · 링크 (A02) ─────
export type ReportStatus = "open" | "done";
export type ReportKind = "chat" | "vendor" | "link";
export async function listReports(status: ReportStatus, kind?: ReportKind): Promise<AdminReportPage> {
  if (MOCK) return M.mockReportPage(status, kind);
  const qs = new URLSearchParams({ status });
  if (kind) qs.set("kind", kind);
  return (await serverGet<AdminReportPage>(`/admin/reports?${qs.toString()}`)) ?? { items: [], counts: {} };
}
export async function getReport(id: string): Promise<AdminReportDetail | null> {
  if (!UUID.test(id)) return null;
  if (MOCK) return M.MOCK_REPORT_DETAIL[id] ?? null;
  return serverGet<AdminReportDetail>(`/admin/reports/${enc(id)}`);
}

// ───── 회원 (A03) ─────
export async function listMembers(q?: string, status?: "active" | "suspended"): Promise<AdminMembersPage> {
  if (MOCK) return M.mockMembers(q, status);
  const qs = new URLSearchParams();
  if (q?.trim()) qs.set("q", q.trim());
  if (status) qs.set("status", status);
  const s = qs.toString();
  return (await serverGet<AdminMembersPage>(`/admin/members${s ? `?${s}` : ""}`)) ?? { items: [], next_before: null };
}
