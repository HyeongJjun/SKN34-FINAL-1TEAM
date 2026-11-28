"use client";
// 재재 화면 창들(2026-11-26 사용자: 재재와 대화에서 다 해결, 다른 화면으로 옮기지 않기).
// 표준견적서 · 업체 자세히 창과 같은 틀(StandardDialog.module.css)에 기본 정보 고치기 · 공정표 · 업체 채팅 · 리뷰 · 공사 일정 · 용어 · 결정 기록을 띄워요.
// 금액 · 날짜는 모두 API 값 그대로예요. 쓰기는 각 조각이 원래 부르던 API 그대로(StepForm PATCH · ReviewForm · DatesActions …).
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ExpectedPlan } from "@/components/plan/ExpectedPlan";
import { FinalPlanAside, FinalPlanBody } from "@/components/plan/FinalPlanView";
import { DocsTable } from "@/components/docs/DocsTable";
import { LogList } from "@/components/project/LogList";
import { ReviewForm } from "@/components/schedule/ReviewForm";
import { ScheduleGoProvider, type ScheduleGo } from "@/components/schedule/nav";
import { datesView, doneView, extraView } from "@/components/schedule/views";
import type { ScheduleView } from "@/components/schedule/v3text";
import { InfoLocked } from "@/components/start/InfoLocked";
import { StepForm } from "@/components/start/StepForm";
import { Conversation } from "@/components/thread/Conversation";
import { Icon } from "@/components/ui/Icon";
import { useModal } from "@/components/ui/useModal";
import type { ApiCheck, ApiPlan, Region } from "@/lib/api/project";
import type { ApiDocs, ApiLogItem, ApiSchedule } from "@/lib/api/schedule";
import type { Message, Thread } from "@/lib/api/thread";
import { call, errorText } from "@/lib/backend/client";
import { placeText, type InfoDraft } from "@/lib/guest/info";
import { termByName } from "@/lib/guide";
import { reviewState, threadOf } from "./boardLink";
import d from "./StandardDialog.module.css";
import s from "./flow.module.css";

export type Win =
  | { kind: "edit" }
  | { kind: "plan" }
  /** 업체 채팅: 상호명이 아니라 실측(visitId) · 채팅(threadId)으로 찾아요(#222 리뷰: 이름이 같거나 비슷한 다른 업체 채팅이 열리지 않게) */
  | { kind: "chat"; vendorName: string | null; visitId?: string | null; threadId?: string | null }
  | { kind: "review" }
  | { kind: "schedule"; view: ScheduleView }
  | { kind: "term"; name: string }
  | { kind: "log" }
  | { kind: "docs" }
  | null;

/** 창 한 개 틀(표준견적서 창과 같아요) */
export function JjWindow({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const h = useModal(ref, open, onClose);
  return (
    <dialog ref={ref} className={d.dlg} aria-labelledby={`${id}-t`} onCancel={h.onCancel} onClick={h.onClick}>
      {open ? (
        <div className={d.card}>
          <div className={d.head}>
            <h2 id={`${id}-t`}>{title}</h2>
            <button type="button" className={d.x} aria-label="닫기" onClick={onClose}><Icon name="close" /></button>
          </div>
          <div className={d.body}>{children}</div>
        </div>
      ) : null}
    </dialog>
  );
}

export type WinData = {
  pid: string;
  projectId: string;
  today: string;
  regions: Region[];
  draft: InfoDraft | null;
  locked: boolean;
  plan: ApiPlan | null;
  checks: ApiCheck[];
  schedule: ApiSchedule | null;
  startDate: string | null;
};

const TITLE: Record<NonNullable<Win>["kind"], string> = { edit: "기본 정보 고치기", plan: "공정표", chat: "업체 채팅", review: "리뷰 쓰기", schedule: "공사 일정", term: "믿집 백과", log: "결정 기록", docs: "서류" };

export function Windows({ win, onClose, onDone, onOpen, data }: { win: Win; onClose: () => void; onDone: (said: string) => void; onOpen: (w: Win) => void; data: WinData }) {
  // 공사 일정 창에서 공정표 · 리뷰 · 채팅 · 공사 날짜로 갈 때 재재 화면 밖으로 나가지 않고 창만 바꿔요(#222 리뷰)
  const go = (to: ScheduleGo) => {
    if (to.kind === "plan") onOpen({ kind: "plan" });
    else if (to.kind === "review") onOpen({ kind: "review" });
    else if (to.kind === "chat") onOpen(to.threadId ? { kind: "chat", vendorName: null, threadId: to.threadId } : null);
    else if (to.kind === "dates") onOpen({ kind: "schedule", view: "dates" });
    else onClose();
  };
  const title = win ? (win.kind === "chat" ? `${win.vendorName ?? "업체"} 채팅` : win.kind === "term" ? `백과 · ${win.name}` : TITLE[win.kind]) : "";
  return (
    <JjWindow open={!!win} title={title} onClose={onClose}>
      {win?.kind === "edit" ? <EditBody data={data} onDone={() => onDone("기본 정보를 고쳤어요")} /> : null}
      {win?.kind === "plan" ? <PlanBody data={data} /> : null}
      {win?.kind === "chat" ? <ChatBody key={`${win.visitId ?? ""}|${win.threadId ?? ""}`} data={data} vendorName={win.vendorName} visitId={win.visitId ?? null} threadId={win.threadId ?? null} /> : null}
      {win?.kind === "review" ? <ReviewBody data={data} onDone={() => onDone("리뷰를 올렸어요")} /> : null}
      {win?.kind === "schedule" ? <ScheduleGoProvider value={go}><ScheduleBody data={data} view={win.view} /></ScheduleGoProvider> : null}
      {win?.kind === "term" ? <TermBody name={win.name} /> : null}
      {win?.kind === "log" ? <LogBody data={data} /> : null}
      {win?.kind === "docs" ? <DocsBody data={data} /> : null}
    </JjWindow>
  );
}

function EditBody({ data, onDone }: { data: WinData; onDone: () => void }) {
  if (!data.draft) return <p className={s.note}>기본 정보를 불러오지 못했어요.</p>;
  if (data.locked) return <InfoLocked draft={data.draft} region={placeText(data.regions, data.draft)} today={data.today} />;
  return <StepForm bare regions={data.regions} today={data.today} mode="edit" projectId={data.projectId} initial={data.draft} mock={false} crumbs={[]} onDone={onDone} />;
}

function PlanBody({ data }: { data: WinData }) {
  const p = data.plan;
  if (!p) return <p className={s.note}>공정표를 불러오지 못했어요.</p>;
  if (p.kind === "final") {
    return (
      <>
        <FinalPlanBody plan={p} projectId={data.projectId} checks={data.checks} mock={false} />
        <FinalPlanAside plan={p} projectId={data.projectId} checks={data.checks} mock={false} />
      </>
    );
  }
  return (
    <>
      <p className={s.note}>예상 공정표예요. 업체를 확정하고 공사 날짜를 수락하면 확정 공정표로 바뀌어요.</p>
      <ExpectedPlan plan={p} />
    </>
  );
}

/** 이 공사 · 이 업체 채팅을 찾아 그대로 띄워요(GET /threads → /threads/{id} · 글). 실측을 요청해야 열려요 */
function ChatBody({ data, vendorName, visitId, threadId }: { data: WinData; vendorName: string | null; visitId: string | null; threadId: string | null }) {
  const [got, setGot] = useState<{ thread: Thread; msgs: Message[]; label: string | null } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      const rows = await call<{ thread_id: string; title: string; visit_label: string | null }[]>("GET", "/threads");
      // 채팅 ID가 있으면 바로, 없으면 이 공사 · 이 실측의 채팅을 찾아요(상호명으로 고르지 않아요)
      const heads: Thread[] = [];
      for (const r of threadId ? rows.filter((x) => x.thread_id === threadId) : rows) {
        const t = await call<Thread>("GET", `/threads/${encodeURIComponent(r.thread_id)}`);
        heads.push(t);
        if (threadOf([t], data.projectId, { visitId, threadId })) break;
      }
      const t = threadOf(heads, data.projectId, { visitId, threadId });
      if (t) {
        const msgs = await call<Message[]>("GET", `/threads/${encodeURIComponent(t.thread_id)}/messages?limit=50`);
        if (live) setGot({ thread: t, msgs, label: rows.find((r) => r.thread_id === t.thread_id)?.visit_label ?? null });
        return;
      }
      if (live) setErr(`${vendorName ?? "업체"} 채팅은 실측을 요청하면 열려요.`);
    })().catch((e) => { if (live) setErr(errorText(e)); });
    return () => { live = false; };
  }, [data.projectId, vendorName, visitId, threadId]);
  if (err) return <p className={s.note}>{err}</p>;
  if (!got) return <p className={s.note}>채팅을 여는 중이에요</p>;
  return <div className={s.chatWin}><Conversation role="customer" thread={got.thread} visit={null} visitLabel={got.label} initial={got.msgs} today={data.today} /></div>;
}

function ReviewBody({ data, onDone }: { data: WinData; onDone: () => void }) {
  // 옛 리뷰 화면과 같은 조건(#237 리뷰): 공사 끝을 확인한 뒤(review_open)만 쓰고, 이미 썼으면 쓴 안내
  const deal = (data.schedule?.trades.find((x) => x.deal.trade === "dobae") ?? data.schedule?.trades[0])?.deal ?? null;
  const st = reviewState(deal);
  if (st === "form" && deal) return <ReviewForm projectId={data.projectId} dealId={deal.id} vendorId={deal.vendor_id} onDone={onDone} />;
  if (st === "done") return <p className={s.note}>리뷰를 썼어요. 공사마다 리뷰는 한 번 써요.</p>;
  return <p className={s.note}>공사 끝을 확인하면 리뷰를 쓸 수 있어요. 믿집에서 공사를 끝낸 고객만 써요.</p>;
}

function ScheduleBody({ data, view }: { data: WinData; view: ScheduleView }) {
  const sch = data.schedule;
  const t = sch?.trades.find((x) => x.deal.trade === "dobae");
  if (!sch || !t) return <p className={s.note}>업체를 확정하면 공사 날짜가 여기에 와요.</p>;
  const ctx = { projectId: data.projectId, t, holidays: sch.holidays, finalVersion: sch.final_version, today: data.today, startDate: data.startDate, requestDue: sch.request_due_preview ?? null };
  const v = view === "extra" ? extraView(ctx) : view === "done" ? doneView(ctx) : datesView(ctx);
  return <>{v.body}{v.bar}</>;
}

/** 결정 기록(C63): 실측 일정 · 견적서 · 공사 이력을 시간 순으로. 열 때 GET /projects/{id}/log로 새로 읽어요 */
function LogBody({ data }: { data: WinData }) {
  const [items, setItems] = useState<ApiLogItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    call<ApiLogItem[]>("GET", `/projects/${data.pid}/log`).then((x) => { if (live) setItems(x); }).catch((e) => { if (live) setErr(errorText(e)); });
    return () => { live = false; };
  }, [data.pid]);
  if (err) return <p className="mj-error" role="alert">{err}</p>;
  if (!items) return <p className={s.note}>기록을 불러오는 중이에요</p>;
  return <LogList items={items} />;
}

/** 서류(UC-PRJ-04): 표준견적서 · 공정표 · 실측 견적서 · 추가 금액 기록. 열 때 GET /projects/{id}/docs */
function DocsBody({ data }: { data: WinData }) {
  const [docs, setDocs] = useState<ApiDocs | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    call<ApiDocs>("GET", `/projects/${data.pid}/docs`).then((x) => { if (live) setDocs(x); }).catch((e) => { if (live) setErr(errorText(e)); });
    return () => { live = false; };
  }, [data.pid]);
  if (err) return <p className="mj-error" role="alert">{err}</p>;
  if (!docs) return <p className={s.note}>서류를 불러오는 중이에요</p>;
  const trades = (["mokgong", "dobae"] as const).filter((t) => docs.standard.some((x) => x.trade === t));
  return <DocsTable docs={docs} trades={[...trades]} deals={(data.schedule?.trades ?? []).map((t) => t.deal)} />;
}

function TermBody({ name }: { name: string }) {
  const t = termByName(name);
  if (!t) return <p className={s.note}>백과에 없는 말이에요.</p>;
  return (
    <div className={s.card}>
      <h4>{t.term}</h4>
      <p>{t.easy}</p>
      {t.tip ? <p className={s.why}>팁: {t.tip}</p> : null}
      {t.detail ? <p className={s.note}>{t.detail}</p> : null}
    </div>
  );
}
