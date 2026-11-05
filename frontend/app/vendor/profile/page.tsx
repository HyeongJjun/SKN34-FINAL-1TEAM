import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/pro/profile/ProfileForm";
import { TRADE_KEYS, type Prices, type Trade } from "@/components/pro/profile/text";
import { SiteHeader } from "@/components/site/SiteHeader";
import { listRegions } from "@/lib/api/project";
import { getMyPrices, getMyProfile } from "@/lib/api/vendor";
import { requireRole } from "@/lib/session";

export const metadata = { title: "업체 정보" };

// 업체 정보 (시안 WVProfile). 승인된 업체만 고친다. 승인 전이면 업체 홈이 낸 신청 내용을 보여 준다.
export default async function VendorProfilePage() {
  await requireRole("vendor", "/vendor/profile");
  const profile = await getMyProfile();
  if (!profile) redirect("/vendor");
  const trades = TRADE_KEYS.filter((t) => profile.trades.includes(t));
  const [regions, list] = await Promise.all([listRegions(), Promise.all(trades.map((t) => getMyPrices(t)))]);
  const prices: Partial<Record<Trade, Prices>> = {};
  trades.forEach((t, i) => { const p = list[i]; if (p) prices[t] = p; });
  return (
    <>
      <SiteHeader />
      <ProfileForm profile={profile} regions={regions} prices={prices} />
    </>
  );
}
