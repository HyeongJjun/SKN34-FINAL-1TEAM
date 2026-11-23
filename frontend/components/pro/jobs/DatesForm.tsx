"use client";
// 공사 날짜 올리기(V11 v_dates): 확정된 업체가 공사할 날을 하나씩 골라 보내요(시작 ~ 끝 범위가 아니에요).
// 고른 날 수 = 견적서 공사 기간이어야 보내지고, 공휴일 · 겹침은 계산 엔진이 다시 봐요(422). → POST /vendor/jobs/{did}/dates(멱등 키).
// 고객이 다른 날짜를 요청했으면(C52) 그 요청에 답하는 새 날짜예요(request_id).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Main, PageHead } from "@/components/site/Frame";
import { BottomBar } from "@/components/ui/BottomBar";
import { Button } from "@/components/ui/Button";
import { Calendar, type DayMark, type DayNote } from "@/components/ui/Calendar";
import { SelectField } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import type { JobV3 } from "@/lib/api/vendor";
import { errorText } from "@/lib/backend/client";
import { dateLong, dateSeoul, dueText, won } from "@/lib/format";
import { enc, newKey, send } from "../send";
import { Notice } from "@/components/ui/Notice";
import { Group, Lead, Row, Rows, Small } from "../ui/parts";
import { visitTitle } from "../visit/facts";
import { daysText } from "./days";
import { AssistBox } from "../assist/AssistBox";
import { parseDates } from "../assist/parse";
import s from "./jobs.module.css";

/** 예시 글: 희망 시작일부터 공사 기간만큼 "12/8부터 12/10까지, 2명" */
function example(start: string, n: number): string {
  const d = new Date(`${start}T00:00:00Z`);
  const md = (x: Date) => `${x.getUTCMonth() + 1}/${x.getUTCDate()}`;
  const a = md(d);
  d.setUTCDate(d.getUTCDate() + Math.max(n, 1) - 1);
  return `${a}부터 ${md(d)}까지, 2명`;
}

const CREW = [1, 2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: `${n}명` }));

export function DatesForm({ job, now }: { job: JobV3; now: string }) {
  const router = useRouter();
  const toast = useToast();
  const v = job.visit;
  const need = job.quote.days ?? job.need.days;
  const [days, setDays] = useState<string[]>(job.proposal && job.dates_state !== "requested" ? job.proposal.days : []);
  const [crew, setCrew] = useState(String(job.proposal?.crew ?? job.need.crew ?? 2));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [idem] = useState(newKey);
  const today = dateSeoul(now);

  const marks: Record<string, DayMark[]> = {};
  const notes: Record<string, DayNote> = {};
  job.holidays.forEach((h) => { marks[h.day] = ["holiday"]; notes[h.day] = { text: h.name.slice(0, 2), label: h.name }; });
  if (v.work_wish_on) notes[v.work_wish_on] = { text: "희망", label: "고객 희망 시작일" };
  job.request?.wish_dates.forEach((d) => { if (!notes[d]) notes[d] = { text: "희망", label: "고객이 요청한 날" }; });

  async function go() {
    if (busy) return;
    if (need && days.length !== need) { setErr(`견적서 공사 기간 ${need}일과 같게 ${need}일을 골라 주세요. 지금 ${days.length}일 골랐어요.`); return; }
    setErr(null);
    setBusy(true);
    try {
      const kind = job.dates_state === "change_requested" || job.dates_state === "scheduled" ? "change" : "initial";
      await send("POST", `/vendor/jobs/${enc(job.deal_id)}/dates`, { days, crew: Number(crew), method: "app", kind, request_id: job.request?.id ?? null }, { idem });
      toast.show("공사 날짜를 보냈어요. 고객이 수락하면 알림으로 알려 드려요.");
      router.refresh();
    } catch (e) {
      setErr(errorText(e));
      setBusy(false);
    }
  }

  function assist(text: string): string {
    const got = parseDates(text, today, job.request?.wish_dates[0] ?? v.work_wish_on, job.holidays.map((h) => h.day), !job.weekend_work);
    if (!got) return "날짜를 못 읽었어요. 예: 12/8부터 12/10까지, 2명";
    if (got.crew && got.crew <= 6) setCrew(String(got.crew));
    const ok = got.days.filter((d) => d > today);
    if (ok.length) { setDays(ok); setErr(null); }
    const said = [ok.length ? `${daysText(ok, true)}(${ok.length}일)` : null, got.crew ? `${got.crew}명` : null].filter(Boolean).join(" · ");
    const gap = need && ok.length && ok.length !== need ? ` 견적서 공사 기간은 ${need}일이라 달력에서 맞춰 주세요.` : "";
    return said ? `${said}로 채웠어요.${gap} 보내기는 직접 눌러 주세요.` : "오늘 뒤 날짜로 말해 주세요.";
  }

  return (
    <>
      <Main narrow>
        <PageHead title="공사 날짜 올리기" crumbs={[{ label: "작업함", href: "/vendor?tab=jobs" }, { label: visitTitle(v) }, { label: "공사 날짜" }]} />
        <Lead title={`${visitTitle(v)} · 확정 ${won(job.quote.total)}`} sub={[need ? `공사 ${need}일` : null, v.work_wish_on ? `고객 희망 시작 ${dateLong(v.work_wish_on)}` : null].filter(Boolean).join(" · ")} />
        {job.request ? (
          <Notice tone="info">고객이 다른 날짜를 요청했어요{job.request.reason ? ` · ${job.request.reason}` : ""} · 희망 {daysText(job.request.wish_dates)} · {dueText(job.request.due_at, { now })} 새 날짜를 보내요.</Notice>
        ) : job.dates_due_at ? <Small red>{dueText(job.dates_due_at, { now })} 올려요</Small> : null}
        <AssistBox hint="공사할 날과 인원을 말로 적으면 달력에 표시해요." examples={[example(job.request?.wish_dates[0] ?? v.work_wish_on ?? today, need ?? 3)]} onText={assist} />
        <Group>
          <Calendar
            mode="multiple"
            label="공사할 날 고르기"
            today={today}
            month={job.request?.wish_dates[0] ?? v.work_wish_on ?? today}
            value={days}
            onChange={(x) => { setDays(x); setErr(null); }}
            marks={marks}
            notes={notes}
            wide
          />
          <Small>공사할 날을 하나씩 눌러요. 한 번 더 누르면 빠져요.</Small>
        </Group>
        <Group>
          <Rows label="보낼 공사 날짜">
            <Row label="고른 날" sub={need ? `견적서 공사 기간 ${need}일` : undefined} value={days.length ? daysText(days, true) : "—"} />
          </Rows>
          <SelectField label="인원" options={CREW} value={crew} onChange={(e) => setCrew(e.target.value)} />
          {err ? <p className={s.err} role="alert"><Icon name="error" size={16} />{err}</p> : null}
        </Group>
      </Main>
      <BottomBar note="고객이 수락하면 확정 공정표가 만들어져요">
        <Button size="lg" block onClick={go} busy={busy}>{busy ? "보내는 중" : "고객에게 보내기"}</Button>
      </BottomBar>
    </>
  );
}
