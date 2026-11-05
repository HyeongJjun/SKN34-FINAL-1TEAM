// 공사 날짜 내기 화면 틀 (시안 WVCalendar): 이동 경로 + 공사 날짜 칸(JobBoard) + 추가 금액 알리기(JobExtras, 고객이 날짜를 수락한 뒤) + 공사 끝냈어요(JobBoard 안 JobFinish).
import Link from "next/link";
import { workText } from "@/components/pro/inbox/text";
import { won } from "@/lib/format";
import { JobBoard } from "./JobBoard";
import { JobExtras } from "./JobExtras";
import { EXTRA_VATS, type Job } from "./text";
import s from "./jobs.module.css";

/** edit: 작업함 '공사 날짜 바꾸기'로 왔으면 바꾸기 칸을 펼쳐 둔다. exempt: 면세 업체(추가 금액은 면세로만) */
export function JobPage({ job, today, edit = false, exempt = false }: { job: Job; today: string; edit?: boolean; exempt?: boolean }) {
  const v = job.visit;
  const who = v.customer?.name ?? v.code;
  const work = workText(v);
  const here = `${who} · ${v.area_name} ${work} 공사 날짜`;
  // 추가 금액: 고객이 공사 날짜를 수락한 뒤(확정 상태가 confirmed가 아님)부터 보인다. 다시 고른 공사에는 없다
  const extras = job.status !== "confirmed" && job.dates_state !== "closed";
  const head = `${who} · ${v.area_name} ${work} · 확정 금액 ${won(job.quote.total)}`; // 확정 견적서 요약에 부가세 방식이 없어 꼬리를 붙이지 않는다
  return (
    <>
      <nav className={`mj-wrap mj-crumb ${s.crumb}`} aria-label="이동 경로">
        <ol>
          <li><Link href="/vendor">작업함</Link><span aria-hidden="true">›</span></li>
          <li><Link href="/vendor?tab=jobs">공사</Link><span aria-hidden="true">›</span></li>
          <li><span aria-current="page">{here}</span></li>
        </ol>
      </nav>
      <main id="main" className={`mj-wrap ${s.page}`}>
        <JobBoard initial={job} today={today} edit={edit}>
          {extras ? (
            <JobExtras dealId={job.deal_id} initial={job} modes={exempt ? ["exempt"] : EXTRA_VATS} head={head} who={v.customer?.name ? `${v.customer.name} 님` : "고객"} />
          ) : null}
        </JobBoard>
      </main>
    </>
  );
}
