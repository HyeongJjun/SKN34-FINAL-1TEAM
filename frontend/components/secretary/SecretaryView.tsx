"use client";
// 비서 화면: 왼쪽 재재와 대화(AiPanel) + 오른쪽 '내 도배 플랜' 8단계(고칠 수 있는 폼 · 체크 · 바로가기).
// - 단계 · 할 일 · 금액 · 기간은 API 값(overview · 비교) 그대로예요. 화면은 줄 세우기 · 이름 붙이기만 해요.
// - '먼저 알림'은 overview의 지금 할 일(todo)을 재재 말풍선으로 보여 줘요(서버가 정한 글, LLM 없음).
// - 단계의 질문 단추는 대화 입력 칸에 글만 넣어요. 보내기 · 저장 · 확정은 사람이 눌러요.
// - 팀 피드백: 업체 직접 고르기 길 · 가견적/확정 금액 꼬리표 · 결정 기록 · 준비 체크 공유 · 현장 정보를 단계 칸에 뒀어요.
import Link from "next/link";
import { useState } from "react";
import { AiPanel } from "@/components/ai/AiPanel";
import { Eyebrow, Group, Row, Rows } from "@/components/project/Kit";
import { PreWorkCheck } from "@/components/project/PreWorkCheck";
import { SiteInfoCard } from "@/components/project/SiteInfoCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { AiScreen } from "@/lib/api/chat";
import type { ApiCompare, ApiOverview } from "@/lib/api/schedule";
import type { VisitProject } from "@/lib/api/visit";
import { areaText, md, won } from "@/lib/format";
import { termByName, termHref } from "@/lib/guide";
import { visitState } from "@/lib/labels";
import s from "./secretary.module.css";

type StepDef = { key: string; label: string; screen: AiScreen; ask: string[]; terms: string[] };
const STEPS: StepDef[] = [
  { key: "home", label: "집", screen: "start", ask: ["도배하려면 뭐부터 해요?"], terms: ["실크 벽지", "합지 벽지"] },
  { key: "standard", label: "견적", screen: "standard", ask: ["철거는 왜 합계에 안 들어가요?", "합지랑 실크는 뭐가 달라요?"], terms: ["퍼티", "초배"] },
  { key: "vendors", label: "업체", screen: "vendors", ask: ["가견적은 어떻게 나와요?", "업체 견적은 왜 달라요?"], terms: ["가견적"] },
  { key: "visit", label: "실측", screen: "visits", ask: ["실측 날짜는 어떻게 정해요?", "실측 때 뭘 준비해요?"], terms: ["실측"] },
  { key: "compare", label: "비교", screen: "quotes", ask: ["실측 견적서 두 곳은 어떻게 비교해요?"], terms: ["부가세", "하자 보수"] },
  { key: "dates", label: "일정", screen: "plan", ask: ["공사 순서가 어떻게 돼요?", "며칠 걸려요?"], terms: ["보양"] },
  { key: "work", label: "공사", screen: "plan", ask: ["공사 중에 추가 금액이 나오면 어떻게 해요?"], terms: ["보양", "걸레받이"] },
  { key: "done", label: "완료", screen: "plan", ask: ["도배가 끝나면 뭘 확인해요?"], terms: ["하자 보수"] },
];

const nowAt = (steps: { state: "done" | "now" | "todo" }[], fallback: number, n: number) => {
  const at = steps.findIndex((x) => x.state === "now");
  if (at >= 0) return at;
  if (steps.length && steps.every((x) => x.state === "done")) return n;
  return Math.max(0, Math.min(n - 1, fallback));
};
/** 공사 6단계 + 실측 뒤 5단계(API 값) → 플랜 8칸의 지금 칸(0~7, 다 끝나면 8) */
function planStep(ov: ApiOverview): number {
  const t = ov.trades[0];
  const cur = nowAt(t?.steps ?? [], t?.current ?? 0, 6);
  if (cur <= 2) return cur;
  if (cur <= 4) return 3;
  const after = nowAt(ov.after_steps, 0, 5);
  return after <= 1 ? 4 : after === 2 ? 5 : after === 3 ? 6 : after === 4 ? 7 : 8;
}
const inSite = (v: string) => v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\");

export function SecretaryView({ p, ov, compare }: { p: VisitProject; ov: ApiOverview; compare: ApiCompare | null }) {
  const base = `/projects/${encodeURIComponent(p.id)}`;
  const now = planStep(ov);
  const [tab, setTab] = useState(Math.min(now, STEPS.length - 1));
  const [draft, setDraft] = useState<{ text: string; key: number }>();
  const [open, setOpen] = useState(false);
  const step = STEPS[tab];
  const todo = ov.todo && ov.todo.text ? ov.todo : null;
  const ask = (text: string) => { setDraft((d) => ({ text, key: (d?.key ?? 0) + 1 })); setOpen(false); };
  const terms = step.terms.map((n) => termByName(n)).filter((t) => t !== undefined);

  return (
    <div className={s.wrap}>
      <section className={s.chat} aria-label="재재와 대화">
        <header className={s.head}>
          <b>재재 · 믿집 비서</b>
          <span>궁금한 걸 물어보세요. 저장 · 확정은 직접 눌러요.</span>
        </header>
        <button type="button" className={s.planBar} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <b className="mj-num">{Math.min(now + 1, 8)}/8 · {STEPS[Math.min(now, 7)].label}</b>
          <span>{open ? "플랜 접기" : "내 플랜 보기"}</span>
        </button>
        <div className={s.talk}>
          {todo ? (
            <div className={s.first}>
              <Eyebrow>재재가 먼저 알려 드려요</Eyebrow>
              <p className={s.firstText}>{todo.text}</p>
              {todo.action && inSite(todo.link) ? <div><Button size="sm" href={todo.link}>{todo.action}</Button></div> : null}
            </div>
          ) : null}
          <AiPanel screen={step.screen} projectId={p.id} embed draft={draft} />
        </div>
      </section>

      <aside className={open ? `${s.plan} ${s.planOpen}` : s.plan} aria-label="내 도배 플랜">
        <h2 className={s.planT}>내 도배 플랜 <Badge tone="mute">{Math.min(now + 1, 8)}/8 단계</Badge></h2>
        <div className={s.tabs} role="tablist" aria-label="플랜 단계">
          {STEPS.map((st, i) => (
            <button key={st.key} type="button" role="tab" aria-selected={tab === i} className={[s.tab, tab === i ? s.tabOn : "", i < now ? s.tabDone : ""].filter(Boolean).join(" ")} onClick={() => setTab(i)}>
              <span className={s.dot}>{i < now ? "✓" : i + 1}</span>
              {st.label}
            </button>
          ))}
        </div>

        <div className={s.panel} role="tabpanel">
          <h3 className={s.stepT}>{tab + 1}. {step.label} {tab === now ? <Badge tone="now">지금</Badge> : tab < now ? <Badge tone="ok">끝남</Badge> : null}</h3>
          <StepBody k={step.key} p={p} ov={ov} compare={compare} base={base} />

          <div className={s.block}>
            <Eyebrow>재재에게 물어보기</Eyebrow>
            <div className={s.chips}>
              {step.ask.map((q) => <Button key={q} variant="weak" size="sm" onClick={() => ask(q)}>{q}</Button>)}
            </div>
          </div>
          {terms.length ? (
            <div className={s.block}>
              <Eyebrow>믿집 백과에서 보기</Eyebrow>
              <div className={s.chips}>
                {terms.map((t) => <Link key={t.id} className={s.term} href={termHref(t)}>{t.term}</Link>)}
                <Link className={s.term} href="/guide">백과 전체</Link>
              </div>
            </div>
          ) : null}
        </div>
        <Link className={s.log} href={`${base}?tab=log`}>결정 기록 보기 · 누가 언제 무엇을 정했는지</Link>
      </aside>
    </div>
  );
}

function StepBody({ k, p, ov, compare, base }: { k: string; p: VisitProject; ov: ApiOverview; compare: ApiCompare | null; base: string }) {
  const quoteOf = (visitId: string) => compare?.vendors.find((r) => r.visit_id === visitId)?.latest ?? null;
  const deal = compare?.deal ?? null;
  if (k === "home") {
    const home = [`도배 ${p.scope === "partial" ? "부분" : "전체"}`, [p.emd ?? p.sgg, p.areaM2 ? areaText(p.areaM2, p.areaBasis) : null].filter(Boolean).join(" "), p.occupied ? "사는 중" : "빈 집"].filter(Boolean).join(" · ");
    return (
      <>
        <Group list><Rows><Row label="기본 정보" sub={p.locked ? `${home} · 요청 뒤라 잠겼어요` : home} href={`/start?edit=${encodeURIComponent(p.id)}`} /></Rows></Group>
        {ov.phase === "done" ? null : <SiteInfoCard projectId={p.id} />}
      </>
    );
  }
  if (k === "standard") {
    return (
      <Group list><Rows>
        <Row label="표준견적서" sub="공공 기준으로 믿집이 계산한 참고 금액 · 업체 견적이 아니에요" value={compare ? won(compare.standard_total) : undefined} valueSub href={`${base}/standard`} />
        <Row label="예상 공정표" href={`${base}/plan`} />
      </Rows></Group>
    );
  }
  if (k === "vendors" || k === "visit") {
    return (
      <>
        <Group list><Rows>
          {ov.vendors.length ? ov.vendors.map((v) => {
            const st = visitState(v.status, "customer");
            return <Row key={v.visit_id} label={v.vendor_name} sub={k === "vendors" ? "가견적 · 실측 전 금액" : undefined} value={<Badge tone={v.status === "chosen" ? "ok" : v.status === "closed" ? "mute" : "wait"}>{st.label}</Badge>} />;
          }) : <Row label="담은 업체가 없어요" sub="업체를 담으면 여기에 보여요" out />}
        </Rows></Group>
        {k === "vendors" ? (
          <>
            {/* 피드백: 비서가 고른 업체만 보이지 않게, 전체 목록에서 직접 고르는 길을 늘 둬요 */}
            <div className={s.btns}><Button size="sm" variant="secondary" href={`${base}/vendors`}>전체 업체에서 직접 고르기</Button></div>
          </>
        ) : <div className={s.btns}><Button size="sm" variant="secondary" href={`${base}/visits`}>실측 일정 보기</Button></div>}
      </>
    );
  }
  if (k === "compare") {
    const rows = (compare?.vendors ?? []).filter((r) => r.latest);
    return (
      <>
        <Group list><Rows>
          {rows.length ? rows.map((r) => {
            const chosen = deal?.visit_id === r.visit_id;
            return <Row key={r.visit_id} label={ov.vendors.find((v) => v.visit_id === r.visit_id)?.vendor_name ?? "업체"} sub={chosen ? "확정 금액 · 고객이 확정한 견적서" : "실측 견적서 · 확정 전 금액"} value={won((chosen ? deal?.quote.total : null) ?? quoteOf(r.visit_id)?.total ?? 0)} />;
          }) : <Row label="실측 견적서가 아직 없어요" sub="실측을 받으면 업체가 올려요" out />}
        </Rows></Group>
        <div className={s.btns}><Button size="sm" variant="secondary" href={`${base}/quotes`}>견적서 비교 화면</Button></div>
      </>
    );
  }
  if (k === "dates" || k === "work") {
    const final = ov.period.kind === "final";
    return (
      <>
        <Group list><Rows>
          <Row label={final ? "공사 기간" : "예상 기간"} sub={final ? "수락한 공사 날짜" : "공사 날짜를 수락하면 확정돼요"} value={`${md(ov.period.start)} ~ ${md(ov.period.end)}`} href={`${base}/plan`} />
          {k === "work" && deal ? <Row label="확정 금액" sub="승인한 추가 금액은 공정표 화면에 따로 보여요" value={won(deal.quote.total)} href={`${base}/schedule`} /> : null}
        </Rows></Group>
        {/* 피드백: 고객이 끝낸 준비를 업체도 봐요(업체 공사 화면 '고객 준비') */}
        {ov.checks.length && ov.phase !== "done" ? <PreWorkCheck projectId={p.id} checks={ov.checks} start={final ? ov.period.start : null} /> : null}
      </>
    );
  }
  return (
    <Group list><Rows>
      <Row label="공사 끝 확인" sub="업체가 끝을 알리면 마감을 같이 확인해요" href={`${base}/schedule`} />
      <Row label="리뷰" sub="공사가 끝나면 남길 수 있어요" href={`${base}/review`} />
    </Rows></Group>
  );
}
