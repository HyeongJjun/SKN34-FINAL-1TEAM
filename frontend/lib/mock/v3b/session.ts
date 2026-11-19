// B2b 화면의 로그인 확인 한 곳. 운영 · 실제 API에서는 lib/session.ts requireRole 그대로예요.
// 예시 데이터(MOCK_V3B, 개발에서만)이고 진짜 세션이 없을 때만 가상의 고객으로 봐요(쿠키 mj_v3b_role=vendor면 가상의 업체 '마루와벽').
// 이름 · 이메일은 모두 가상이에요. 머리 · 탭 바(B4)는 진짜 세션만 보므로 이때는 손님 머리로 보여요.
import { cookies } from "next/headers";
import { getSession, requireRole } from "@/lib/session";
import type { Role, Session } from "@/lib/types";
import { MOCK_V3B } from "./mode";

export const ROLE_COOKIE = "mj_v3b_role";
const MOCK_CUSTOMER: Session = { id: "7a3e1c00-0000-4000-8000-00000000e001", email: "haneul@example.com", name: "김하늘", role: "customer", vendorStatus: null, vendorRejectReason: null, phone: "01012345678", joinedAt: "2026-11-17T21:00:00+09:00" };
const MOCK_VENDOR: Session = { id: "7a3e1c00-0000-4000-8000-00000000e002", email: "maru@example.com", name: "마루와벽", role: "vendor", vendorStatus: "approved", vendorRejectReason: null, phone: null, joinedAt: "2026-11-03T10:00:00+09:00" };

/** 예시 데이터에서 진짜 세션이 없을 때 쓸 가상의 사람(없으면 null) */
export async function mockSession(): Promise<Session | null> {
  if (!MOCK_V3B || (await getSession())) return null;
  return (await cookies()).get(ROLE_COOKIE)?.value === "vendor" ? MOCK_VENDOR : MOCK_CUSTOMER;
}

export async function requireRoleV3b(role: Role | Role[], next: string): Promise<Session> {
  const fake = await mockSession();
  if (fake && (Array.isArray(role) ? role : [role]).includes(fake.role)) return fake;
  return requireRole(role, next);
}
