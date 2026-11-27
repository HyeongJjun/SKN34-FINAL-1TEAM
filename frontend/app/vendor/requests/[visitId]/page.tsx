import { notFound } from "next/navigation";
import { ProHeader } from "@/components/pro/Shell";
import { AcceptForm } from "@/components/pro/visit/AcceptForm";
import { MarkSeen } from "@/components/pro/visit/MarkSeen";
import { PeriodForm } from "@/components/pro/visit/PeriodForm";
import { ProposeForm } from "@/components/pro/visit/ProposeForm";
import { VisitStatus } from "@/components/pro/visit/VisitStatus";
import { Desk } from "@/components/pro/desk/Desk";
import { deskFeed } from "@/components/pro/desk/feed";
import { visitTitle } from "@/components/pro/visit/facts";
import { approvedVendorGate, getVendorVisit, vendorNow } from "@/lib/api/vendor";

export const metadata = { title: "실측 요청" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// 받은 실측 요청 하나(알림 link: /vendor/requests/{vid}). 상태에 따라:
// 새 요청 → 기간 답하기(V04 · D14, ?decline=1이면 못 받아요 시트 V05) · 고객이 고른 날 → 날짜 수락(V06) · ?step=propose → 다른 날 제안(V07)
// · 그 밖 → 상태 보기. 남의 요청이면 404(있는지도 알리지 않아요).
export default async function VendorRequestPage({ params, searchParams }: { params: Promise<{ visitId: string }>; searchParams: Promise<{ step?: string | string[]; decline?: string | string[] }> }) {
  const { visitId } = await params;
  const sp = await searchParams;
  const me = await approvedVendorGate(`/vendor/requests/${encodeURIComponent(visitId)}`);
  const v = await getVendorVisit(visitId);
  if (!v) notFound();
  const back = "/vendor";
  const feed = await deskFeed(v.id, vendorNow("inbox"));
  const title = visitTitle(v);
  if (v.status === "requested") {
    return (
      <>
        <ProHeader me={me} phone={{ title: "기간 답하기", back }} />
        {v.new ? <MarkSeen visitId={v.id} /> : null}
        <Desk feed={feed} say={[`새 실측 요청이 왔어요. ${title}.`, "되는 기간을 말로 적으면 오른쪽 달력에 표시해 드릴게요. 보내기는 직접 눌러 주세요."]}>
          <PeriodForm v={v} now={vendorNow("period")} openDecline={one(sp.decline) === "1"} />
        </Desk>
      </>
    );
  }
  if (v.status === "picked" && one(sp.step) === "propose") {
    return (
      <>
        <ProHeader me={me} phone={{ title: "다른 날 제안", back: `/vendor/requests/${encodeURIComponent(v.id)}` }} />
        <Desk feed={feed} say={["고객이 고른 날이 어려우면 다른 날을 제안해 주세요.", "고객이 다시 고르면 알려 드릴게요."]}>
          <ProposeForm v={v} />
        </Desk>
      </>
    );
  }
  if (v.status === "picked") {
    return (
      <>
        <ProHeader me={me} phone={{ title: "날짜 수락", back }} />
        <Desk feed={feed} say={[`${title} 고객이 실측 반나절을 골랐어요.`, "현장 정보를 보고 수락 · 다른 날 제안 · 못 받아요를 골라 주세요. 궁금한 건 고객 채팅으로 물어봐요."]}>
          <AcceptForm v={v} now={vendorNow("accept")} />
        </Desk>
      </>
    );
  }
  return (
    <>
      <ProHeader me={me} phone={{ title: "실측 요청", back }} />
      <Desk feed={feed} say={v.status === "booked" ? ["실측 날이 잡혔어요.", "다녀오시면 실측 견적서를 올려 주세요. 현장 정보(주차 · 출입)는 오른쪽에서 볼 수 있어요."] : [`${title} 요청의 지금 상태예요.`]}>
        <VisitStatus v={v} now={vendorNow("inbox")} />
      </Desk>
    </>
  );
}
