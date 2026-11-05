import { notFound, redirect } from "next/navigation";
import { JobPage } from "@/components/pro/jobs/JobPage";
import { SiteHeader } from "@/components/site/SiteHeader";
import { getVendorJob } from "@/lib/api/schedule";
import { getMyProfile } from "@/lib/api/vendor";
import { todaySeoul } from "@/lib/format";
import { requireRole } from "@/lib/session";

export const metadata = { title: "공사 날짜 내기" };

// 공사 날짜 내기 · 다시 내기 · 고객 요청에 답하기 · 수락한 날짜 바꾸기 · 추가 금액 알리기 · 공사 끝냈어요 (시안 WVCalendar). 작업함 '공사 끝냈어요'는 #j-finish로 온다. 알림 link가 이 주소다. 내 공사가 아니면 404(있는지도 알리지 않는다).
// ?change=1: 작업함 '공사 날짜 바꾸기'로 왔다 (바꾸기 칸을 펼쳐 둔다). 면세 업체는 추가 금액을 면세로만 적는다(업체 정보 tax_kind).
export default async function VendorJobPage({ params, searchParams }: { params: Promise<{ dealId: string }>; searchParams: Promise<{ change?: string }> }) {
  const { dealId } = await params;
  const { change } = await searchParams;
  const me = await requireRole("vendor", `/vendor/jobs/${dealId}`);
  if (me.vendorStatus !== "approved") redirect("/vendor");
  const [job, profile] = await Promise.all([getVendorJob(dealId), getMyProfile().catch(() => null)]); // 업체 정보를 못 읽으면 과세로 두고 서버가 거른다
  if (!job) notFound();
  return (
    <>
      <SiteHeader />
      <JobPage job={job} today={todaySeoul()} edit={change === "1"} exempt={profile?.tax_kind === "exempt"} />
    </>
  );
}
