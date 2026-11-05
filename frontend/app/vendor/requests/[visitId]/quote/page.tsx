import { notFound, redirect } from "next/navigation";
import { QuotePage } from "@/components/pro/quote/QuotePage";
import { SiteHeader } from "@/components/site/SiteHeader";
import { getMyQuoteBoard } from "@/lib/api/quote";
import { getVendorVisit } from "@/lib/api/visit";
import { todaySeoul } from "@/lib/format";
import { requireRole } from "@/lib/session";

export const metadata = { title: "실측 견적서 올리기" };

// 실측 견적서 올리기 · 보낸 견적서 보기 (시안 WVQuote). 내 요청이 아니면 404(있는지도 알리지 않는다).
export default async function VendorQuotePage({ params }: { params: Promise<{ visitId: string }> }) {
  const { visitId } = await params;
  const me = await requireRole("vendor", `/vendor/requests/${visitId}/quote`);
  if (me.vendorStatus !== "approved") redirect("/vendor");
  const [v, board] = await Promise.all([getVendorVisit(visitId), getMyQuoteBoard(visitId)]);
  if (!v || !board) notFound();
  return (
    <>
      <SiteHeader />
      <QuotePage v={v} board={board} today={todaySeoul()} />
    </>
  );
}
