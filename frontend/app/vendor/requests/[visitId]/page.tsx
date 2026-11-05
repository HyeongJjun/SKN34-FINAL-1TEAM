import { notFound, redirect } from "next/navigation";
import { Request } from "@/components/pro/inbox/Request";
import { SiteHeader } from "@/components/site/SiteHeader";
import { getMyProfile } from "@/lib/api/vendor";
import { getVendorVisit } from "@/lib/api/visit";
import { requireRole } from "@/lib/session";

export const metadata = { title: "실측 요청" };

// 받은 실측 요청 자세히 (시안 WVInbox). 알림 link가 이 주소다. 내 요청이 아니면 404(있는지도 알리지 않는다).
export default async function VendorRequestPage({ params }: { params: Promise<{ visitId: string }> }) {
  const { visitId } = await params;
  const me = await requireRole("vendor", `/vendor/requests/${visitId}`);
  if (me.vendorStatus !== "approved") redirect("/vendor");
  const [v, profile] = await Promise.all([getVendorVisit(visitId), getMyProfile().catch(() => null)]);
  if (!v) notFound();
  return (
    <>
      <SiteHeader />
      <Request v={v} profile={profile} />
    </>
  );
}
