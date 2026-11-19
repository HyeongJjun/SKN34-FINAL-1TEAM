// 관리자 화면 예시 데이터(B3). 모양은 API 계약(schema.d.ts · api.md 13장)과 같아요. 사람 · 업체 · 글은 모두 가상이에요.
import type { AdminMembersPage, AdminReportDetail, AdminReportPage, ReportRowV3, VendorApplication, VendorApplicationDetail } from "@/lib/api/admin";

const id = (n: string) => `00000000-0000-4000-8000-${n.padStart(12, "0")}`;
export const AVID = { maru: id("b001"), bareun: id("b002"), hangyeol: id("b003") };
export const RID = { chat: id("c101"), link: id("c102"), done: id("c103") };

const lic = (n: string, filename: string, size: number, type = "image/jpeg") => ({ id: id(n), filename, content_type: type, size, created_at: "2026-11-03T10:00:00+09:00" });
function app(p: Partial<VendorApplication> & Pick<VendorApplication, "user_id" | "biz_name" | "status" | "created_at">): VendorApplication {
  return {
    name: p.biz_name ?? "", email: "vendor@example.com", review_code: null, review_note: null, reviewed_at: null, approved_at: null,
    opened_on: null, submitted_at: p.created_at, waiting_days: null, resubmitted: false, changes: null, owner_name: "이○○",
    biz_no: "1234567890", phone: "01012345678", address: null, site_url: null, trades: ["dobae"], areas: [], intro: "",
    license_file_id: id("f001"), license: null, ...p,
  };
}
const AREA = (sgg: string) => ({ sido: "seoul", sgg, label: `서울 ${sgg}` });

export const MOCK_ADMIN_VENDORS: VendorApplication[] = [
  app({ user_id: AVID.maru, biz_name: "마루와벽", status: "pending", created_at: "2026-11-03T10:00:00+09:00", waiting_days: 1,
    areas: [AREA("노원구"), AREA("도봉구"), AREA("중랑구"), AREA("성북구")], license: lic("f001", "사업자등록증.jpg", 1258291) }),
  app({ user_id: AVID.bareun, biz_name: "바른벽", owner_name: "박○○", biz_no: "2208612345", status: "needs_info", created_at: "2026-11-02T15:00:00+09:00",
    review_code: "blurry", reviewed_at: "2026-11-02T18:00:00+09:00", areas: [AREA("강북구")], license: lic("f002", "등록증.png", 830000, "image/png") }),
  app({ user_id: AVID.hangyeol, biz_name: "한결인테리어", owner_name: "최○○", biz_no: "1058799999", status: "approved", created_at: "2026-10-30T11:00:00+09:00",
    reviewed_at: "2026-10-31T10:00:00+09:00", approved_at: "2026-10-31T10:00:00+09:00", trades: ["dobae", "mokgong"], areas: [AREA("노원구")], license: lic("f003", "사업자등록증.pdf", 412000, "application/pdf") }),
];

export const MOCK_ADMIN_DETAIL: Record<string, VendorApplicationDetail> = Object.fromEntries(MOCK_ADMIN_VENDORS.map((v) => [v.user_id, {
  ...v,
  reviews: [{ id: id("h" + v.user_id.slice(-3)), action: "apply", code: null, note: null, changes: null, by_id: null, by_name: null, at: v.created_at }],
  review_links: v.user_id === AVID.maru ? [
    { sort: 1, label: "네이버 플레이스", url: "https://map.naver.com/", status: "shown" as const, note: null, checked_at: "2026-11-04T10:00:00+09:00" },
    { sort: 2, label: "블로그 후기", url: "https://blog.naver.com/", status: "checking" as const, note: null, checked_at: null },
  ] : [],
  same_name: [],
  suspended_at: null, suspend_scope: null,
}]));

// ───── 신고 · 링크 (A02) ─────
const reportRow = (p: Partial<ReportRowV3> & Pick<ReportRowV3, "id" | "kind" | "reason_code" | "status" | "created_at" | "vendor_name">): ReportRowV3 => ({
  action: null, reporter_role: "customer", vendor_id: AVID.bareun, thread_id: null, block: false, resolved_at: null, ...p,
});
export const MOCK_REPORT_ROWS: ReportRowV3[] = [
  reportRow({ id: RID.chat, kind: "chat", reason_code: "offsite", status: "open", created_at: "2026-11-20T14:02:00+09:00", vendor_name: "바른벽", thread_id: id("e201"), block: true }),
  reportRow({ id: RID.link, kind: "link", reason_code: "wrong_place", status: "open", created_at: "2026-11-19T09:40:00+09:00", vendor_name: "결도배", vendor_id: id("b004") }),
  reportRow({ id: RID.done, kind: "chat", reason_code: "promise", status: "resolved", action: "warn", created_at: "2026-11-12T16:20:00+09:00", resolved_at: "2026-11-12T18:00:00+09:00", vendor_name: "한결인테리어", vendor_id: AVID.hangyeol }),
];
export const MOCK_REPORT_COUNTS = { open: 2, done: 1 };
export function mockReportPage(status: "open" | "done", kind?: string): AdminReportPage {
  const items = MOCK_REPORT_ROWS.filter((r) => (status === "open" ? r.status === "open" : r.status !== "open") && (!kind || r.kind === kind));
  return { items, counts: MOCK_REPORT_COUNTS };
}
export const MOCK_REPORT_DETAIL: Record<string, AdminReportDetail> = {
  [RID.chat]: { ...MOCK_REPORT_ROWS[0], note: null, evidence: "현금으로 하시면 10% 빼 드릴게요. 계약은 따로 하시죠.", link_sort: null, link_label: null, link_url: null, admin_note: null, history: [], reporter_label: "수유동 고객" },
  [RID.link]: { ...MOCK_REPORT_ROWS[1], note: "누르면 다른 업체 블로그로 가요", evidence: null, link_sort: 2, admin_note: null, history: [], reporter_label: "상계동 고객", link_label: "블로그 후기", link_url: "https://blog.naver.com/" },
  [RID.done]: { ...MOCK_REPORT_ROWS[2], note: null, evidence: "내일 오기로 하셨는데 연락이 없어요.", link_sort: null, link_label: null, link_url: null, admin_note: "1차 경고", history: [{ id: id("aa01"), action: "warn", note: "1차 경고", admin_name: "관리자", at: "2026-11-12T18:00:00+09:00" }], reporter_label: "중계동 고객" },
};

// ───── 회원 (A03) ─────
const m = (n: string, name: string, email: string, created: string, projects: number, status: "active" | "suspended") => ({ user_id: id(n), name, email, role: "customer" as const, status, created_at: created, project_count: projects });
export const MOCK_MEMBERS = [
  m("m001", "김하늘", "haneul@example.com", "2026-11-16T10:00:00+09:00", 2, "active"),
  m("m002", "김도윤", "doyun@example.com", "2026-11-12T10:00:00+09:00", 1, "active"),
  m("m003", "김서연", "seoyeon@example.com", "2026-11-02T10:00:00+09:00", 0, "active"),
  m("m004", "김민준", "minjun@example.com", "2026-10-21T10:00:00+09:00", 1, "suspended"),
  m("m005", "이지은", "jieun@example.com", "2026-10-15T10:00:00+09:00", 1, "active"),
  m("m006", "박서준", "seojun@example.com", "2026-10-02T10:00:00+09:00", 0, "active"),
];
export function mockMembers(q?: string, status?: "active" | "suspended"): AdminMembersPage {
  const t = (q ?? "").trim();
  return { items: MOCK_MEMBERS.filter((x) => (!t || x.name.includes(t) || x.email.includes(t)) && (!status || x.status === status)), next_before: null };
}
