// 예시 데이터 모드의 로그인한 사람(진짜 세션이 없을 때만 써요). 이름 · 이메일은 모두 가상이에요.
import type { Session } from "@/lib/types";

export const MOCK_VENDOR_ID = "00000000-0000-4000-8000-00000000a001";

export function mockVendorSession(status: "approved" | "pending" | "needs_info" | "rejected" = "approved"): Session {
  return { id: MOCK_VENDOR_ID, email: "maru@example.com", name: "마루와벽", role: "vendor", vendorStatus: status, vendorRejectReason: null, phone: null, joinedAt: "2026-11-03T10:00:00+09:00" };
}

export const MOCK_ADMIN: Session = { id: "00000000-0000-4000-8000-00000000ad01", email: "admin@example.com", name: "관리자", role: "admin", vendorStatus: null, vendorRejectReason: null, phone: null, joinedAt: "2026-09-01T09:00:00+09:00" };
