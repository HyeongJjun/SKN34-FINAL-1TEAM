import { notFound } from "next/navigation";
import { DatesForm } from "@/components/pro/jobs/DatesForm";
import { DoneForm } from "@/components/pro/jobs/DoneForm";
import { ExtraForm } from "@/components/pro/jobs/ExtraForm";
import { JobView } from "@/components/pro/jobs/JobView";
import { ProHeader } from "@/components/pro/Shell";
import { Desk } from "@/components/pro/desk/Desk";
import { deskFeed } from "@/components/pro/desk/feed";
import { visitTitle } from "@/components/pro/visit/facts";
import { approvedVendorGate, getMyProfile, getVendorJob, getVendorJobLog, vendorNow } from "@/lib/api/vendor";

export const metadata = { title: "공사 한 건" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const NEED_DATES = ["waiting", "requested", "change_requested"];

// 공사 한 건(알림 link: /vendor/jobs/{did}). 공사 날짜를 아직 안 냈거나 고객이 다른 날짜를 요청했으면 공사 날짜 올리기(V11),
// 그 밖에는 공사 한 건(V23). ?step=extra 추가 금액(V12) · ?step=done 공사 끝(V13). 남의 공사면 404.
export default async function VendorJobPage({ params, searchParams }: { params: Promise<{ dealId: string }>; searchParams: Promise<{ step?: string | string[] }> }) {
  const { dealId } = await params;
  const step = one((await searchParams).step);
  const me = await approvedVendorGate(`/vendor/jobs/${encodeURIComponent(dealId)}`);
  const job = await getVendorJob(dealId);
  if (!job) notFound();
  const href = `/vendor/jobs/${encodeURIComponent(job.deal_id)}`;
  const feed = await deskFeed(job.deal_id, vendorNow("inbox"));
  const title = visitTitle(job.visit);
  const working = job.status === "fixing" || (job.dates_state === "scheduled" && !job.done_posted_at && !job.work_done_on && job.status !== "done");

  if (step === "extra" && working) {
    const profile = await getMyProfile().catch(() => null);
    return (
      <>
        <ProHeader me={me} phone={{ title: "추가 금액 올리기", back: href }} />
        <Desk feed={feed} say={["추가 금액은 사진과 이유를 같이 올려야 고객이 빨리 답해요.", "항목 · 금액 · 부가세 · 이유를 말로 적으면 칸을 채워요."]}>
          <ExtraForm job={job} taxKind={profile?.tax_kind ?? "general"} />
        </Desk>
      </>
    );
  }
  if (step === "done" && working && job.can_finish) {
    return (
      <>
        <ProHeader me={me} phone={{ title: "공사 끝냈어요", back: href }} />
        <Desk feed={feed} say={["공사를 끝냈으면 마감 사진을 올려 주세요.", "고객이 확인하면 공사가 끝나고 리뷰를 받을 수 있어요."]}>
          <DoneForm job={job} />
        </Desk>
      </>
    );
  }
  if (NEED_DATES.includes(job.dates_state)) {
    return (
      <>
        <ProHeader me={me} phone={{ title: "공사 날짜 올리기", back: "/vendor?tab=jobs" }} />
        <Desk feed={feed} say={[`${title} 공사가 확정됐어요.`, "공사할 날과 인원을 말로 적으면 달력에 표시해요. 견적서 공사 기간과 날 수가 같아야 보낼 수 있어요."]}>
          <DatesForm job={job} now={vendorNow("dates")} />
        </Desk>
      </>
    );
  }
  const log = await getVendorJobLog(job.deal_id);
  return (
    <>
      <ProHeader me={me} phone={{ title: "공사 한 건", back: "/vendor?tab=jobs" }} />
      <Desk feed={feed} say={working ? ["공사 중이에요.", "추가 금액이 생기면 '추가 금액 올리기', 다 끝나면 '공사 끝냈어요'를 눌러 주세요."] : [`${title} 공사 기록이에요.`]}>
        <JobView job={job} log={log} now={vendorNow("inbox")} />
      </Desk>
    </>
  );
}
