// 서버 쪽 읽기: 업체 본인(가입 심사 · 업체 정보 · 가견적 단가). 고객이 보는 업체 목록 · 자세히는 lib/api/visit.ts.
import { serverGet, type Schemas } from "@/lib/backend/server";

export type VendorApplicationMine = Schemas["ApplicationOut"];
export type VendorProfile = Schemas["ProfileOut"];
export type VendorPrices = Schemas["PricesOut"];
/** 내 가입 신청 · 심사 결과 (업체 본인, 승인 전에도) */
export async function getMyApplication() { return serverGet<VendorApplicationMine>("/vendor/application"); }
/** 내 업체 정보 (승인된 업체만, 아니면 null) */
export async function getMyProfile() { return serverGet<VendorProfile>("/vendor/profile"); }
/** 내 가견적 단가 · 근거 파일, 공정 하나 (승인된 업체만, 아니면 null) */
export async function getMyPrices(trade: "dobae" | "mokgong") {
  return serverGet<VendorPrices>(`/vendor/prices?trade=${trade}`);
}
