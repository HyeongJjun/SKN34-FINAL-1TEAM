// 업체 정보 저장 몸통(PUT /vendor/profile, ProfileIn). 기본 · 사례 · 링크 탭이 같은 PUT을 써서, 바꾸지 않는 칸은 지금 값을 그대로 넘겨요.
// updated_at은 다른 곳에서 먼저 저장했는지 보는 값이에요(다르면 409 stale).
import type { ProfileV3 } from "@/lib/api/vendor";
import type { Schemas } from "@/lib/backend/client";

export type ProfileBody = Schemas["ProfileIn"] & { intro?: string | null };
type Tax = Schemas["ProfileIn"]["tax_kind"];
type Contact = Schemas["ProfileIn"]["contact_method"];
const TAX: Tax[] = ["general", "simplified", "exempt"];
const CONTACT: Contact[] = ["phone", "sms", "kakao", "web"];

export function profileBody(p: ProfileV3, over: Partial<ProfileBody> = {}): ProfileBody {
  const body: ProfileBody = {
    updated_at: p.updated_at,
    phone: p.phone ?? "",
    address: p.address,
    site_url: p.site_url,
    trades: p.trades.filter((t): t is "dobae" | "mokgong" => t === "dobae" || t === "mokgong"),
    areas: p.areas.map((a) => ({ sido: a.sido, sgg: a.sgg })),
    contact_method: CONTACT.includes(p.contact_method as Contact) ? (p.contact_method as Contact) : "phone",
    contact_url: p.contact_url,
    call_start: p.call_start,
    call_end: p.call_end,
    visit_fee: p.visit_fee ?? 0,
    visit_fee_refund: p.visit_fee_refund,
    tax_kind: TAX.includes(p.tax_kind as Tax) ? (p.tax_kind as Tax) : "general",
    instant_default: p.instant_default ?? null,
    visit_capacity: p.visit_capacity ?? null,
    interior_license: p.interior_license,
    insurance: p.insurance,
    faqs: p.faqs,
    links: p.links,
    ...over,
  };
  // 한 줄 소개는 API가 이 칸을 줄 때만 보내요(아직 계약에 없어요: 저장되지 않는 칸을 '저장했어요'라고 하지 않게)
  if (!("intro" in p)) delete body.intro;
  return body;
}
