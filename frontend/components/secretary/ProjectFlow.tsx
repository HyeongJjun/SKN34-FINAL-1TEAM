"use client";
// /projects/{id}/assistant(시연 영상 11~48장면): 서버 상태를 읽어 대화 안에 지금 단계 카드를 띄워요. 카드 단추가 기존 API를 불러요.
// - 업체 담기 POST · DELETE /projects/{id}/shortlist · 실측 요청 POST /projects/{id}/visits · 반나절 고르기 POST …/visits/{vid}/pick
// - 견적서 확정 POST …/quotes/{vid}/confirm · 공사 날짜 수락 POST …/deals/{did}/dates/{pid}/accept · 추가 금액 POST …/extras/{eid}/answer
// - 공사 끝 확인 POST …/deals/{did}/check · 리뷰 POST …/deals/{did}/review · 준비 체크 PUT /projects/{id}/checks/{key}
// - 질문은 POST /ai/turns(로그인한 고객 AI). 금액 · 날짜는 API 값 그대로이고, 저장 · 확정 · 승인은 사람이 카드 단추를 눌러요.
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AiAnswer } from "@/components/ai/AiAnswer";
import { vsPct } from "@/components/compare/text";
import { PreWorkCheck } from "@/components/project/PreWorkCheck";
import { SiteInfoCard } from "@/components/project/SiteInfoCard";
import { donePhotoHref } from "@/components/schedule/v3text";
import { Button } from "@/components/ui/Button";
import { iGa as iga } from "@/components/vendors/text";
import { askAi, newClientKey, type AiButton, type AiTurnOut } from "@/lib/api/chat";
import type { ApiCompare, ApiOverview, ApiSchedule } from "@/lib/api/schedule";
import type { ProjectVendors, ProjectVisits, VisitDraft, VisitProject } from "@/lib/api/visit";
import { call, errorText, type Schemas } from "@/lib/backend/client";
import { upload } from "@/lib/mock/v3b/client";
import { dateShort, euro, won } from "@/lib/format";
import { termByName, termHref } from "@/lib/guide";
import { attachTargets } from "./attach";
import { quickChips } from "./chips";
import { Jaejae } from "./Jaejae";
import { Plan } from "./Plan";
import s from "./flow.module.css";

type Pick = Schemas["VisitPickOut"];
const CLOSED = ["declined", "expired", "cancelled", "no_show", "closed"];
type Half = "am" | "pm";
const HALF: Record<Half, string> = { am: "오전", pm: "오후" };
const enc = encodeURIComponent;
const PHOTO_MAX = 3; // 서버 agent/v3/photo.py MAX_PHOTOS와 같아요
const PHOTO_ASK = "이 사진 좀 봐 주세요"; // 사진만 붙이고 글을 안 쓰면 보내는 말

export type FlowData = {
  p: VisitProject;
  ov: ApiOverview;
  compare: ApiCompare | null;
  schedule: ApiSchedule | null;
  visits: ProjectVisits | null;
  vendors: ProjectVendors | null;
  draft: VisitDraft | null;
  today: string;
};

/** 서버 상태 → 플랜 8칸 지금 칸 */
function stepOf(d: FlowData): number {
  const deal = d.schedule?.trades.find((t) => t.deal.trade === "dobae") ?? null;
  if (deal) {
    const st = deal.deal.status;
    if (st === "done") return 8;
    if (st === "checking" || st === "fixing") return 7;
    if (deal.dates_state === "scheduled" || deal.dates_state === "change_requested" || deal.dates_state === "change_proposed") return deal.deal.start_date && deal.deal.start_date <= d.today ? 6 : 5;
    return 5;
  }
  const vs = d.visits?.visits ?? [];
  if (vs.some((v) => v.status === "quoted")) return 4;
  if (vs.some((v) => ["requested", "offered", "picked", "proposed", "booked", "visited"].includes(v.status))) return 3;
  return 2;
}

export function ProjectFlow({ data }: { data: FlowData }) {
  const router = useRouter();
  const { p, ov, compare, schedule, visits, vendors, draft, today } = data;
  const pid = enc(p.id);
  const now = stepOf(data);
  const [open, setOpen] = useState(false);
  const [busyKey, setBusy] = useState<string | null>(null);
  const [refreshing, startRefresh] = useTransition();
  // 새 화면 값이 올 때까지 단추를 막아요(같은 요청을 두 번 보내 409가 나지 않게)
  const busy = busyKey ?? (refreshing ? "refresh" : null);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [asks, setAsks] = useState<{ q: string; pics?: string[]; out?: AiTurnOut; err?: string }[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [attach, setAttach] = useState(false);
  // 재재에게 물어볼 사진(#181 2단계): 먼저 올리고(POST /files kind=photo, 서버가 위치 정보를 지워요) 질문과 함께 id만 보내요
  const [pics, setPics] = useState<{ id: string; src: string; name: string }[]>([]);
  const [picBusy, setPicBusy] = useState(false);
  const [picErr, setPicErr] = useState<string | null>(null);
  const picIn = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [asks.length, now, attach, pics.length]); // 사진 칸을 열면 입력칸이 높아져서 다시 내려요

  async function act(key: string, fn: () => Promise<unknown>) {
    if (busy) return;
    setBusy(key);
    setErr(null);
    setNote(null);
    try { await fn(); startRefresh(() => router.refresh()); } catch (e) { setErr(errorText(e)); } finally { setBusy(null); }
  }

  async function addPics(list: File[]) {
    if (picBusy) return;
    setPicErr(null);
    const room = PHOTO_MAX - pics.length;
    if (list.length > room) setPicErr(`사진은 한 번에 ${PHOTO_MAX}장까지 붙일 수 있어요.`);
    const take = list.slice(0, Math.max(room, 0));
    const bad = take.find((f) => !(f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name)) || f.size > 10 * 1024 * 1024); // 일부 브라우저는 HEIC 형식을 비워 보내요
    if (bad) { setPicErr("사진 파일(10MB까지)만 붙일 수 있어요."); return; }
    setPicBusy(true);
    try {
      for (const f of take) {
        const up = await upload(f, "photo");
        setPics((x) => [...x, { id: up.id, src: URL.createObjectURL(f), name: f.name }]);
      }
    } catch (e) {
      setPicErr(errorText(e));
    } finally {
      setPicBusy(false);
    }
  }

  const asking = asks.length > 0 && !asks[asks.length - 1].out && !asks[asks.length - 1].err;
  /** typed: 입력칸 글을 보낸 것(붙인 사진을 같이 보내고 입력칸을 비워요). 질문 버튼 · 답 안 선택지는 false */
  async function ask(q: string, button: AiButton | null = null, typed = false) {
    const sent = typed ? pics : [];
    const t = (q.trim() || (sent.length ? PHOTO_ASK : "")).slice(0, 1000);
    if (!t || asking || picBusy) return; // 답을 기다리는 동안 새 질문을 막아요(답이 엇갈리지 않게 · 대화 하나로)
    if (typed) { setText(""); setPics([]); setPicErr(null); if (sent.length) setAttach(false); } // 입력칸 글을 보낼 때만 비워요(질문 버튼을 눌러도 쓰던 글은 남겨요). 사진을 보냈으면 사진 칸을 접어 답이 보이게 해요
    setAsks((a) => [...a, { q: t, pics: sent.map((x) => x.src) }]);
    try {
      const out = await askAi({ client_key: newClientKey(), text: t, file_ids: sent.map((x) => x.id), chat_id: chatId, context: { screen: now <= 2 ? "vendors" : now <= 4 ? "quotes" : "plan", project_id: p.id, ids: [] }, button }); // 선택지의 길(route) · 칸 정보를 그대로 넘겨요
      if (out.chat_id) setChatId(out.chat_id);
      setAsks((a) => a.map((x, i) => (i === a.length - 1 ? { ...x, out } : x)));
    } catch (e) {
      setAsks((a) => a.map((x, i) => (i === a.length - 1 ? { ...x, err: errorText(e) } : x)));
      if (sent.length) { setPics(sent); setAttach(true); } // 보내지 못했으면 붙인 사진을 되돌려요(다시 올리지 않게)
    }
  }

  const deal = schedule?.trades.find((t) => t.deal.trade === "dobae") ?? null;
  const all = (visits?.visits ?? []).filter((v) => v.trade === "dobae");
  // 닫힌 요청(거절 · 기한 지남 · 취소 · 안 옴 · 다시 고름)은 진행 중이 아니에요
  const vs = all.filter((v) => !CLOSED.includes(v.status));
  const closed = all.filter((v) => CLOSED.includes(v.status));
  const cards: { key: string; alert?: boolean; node: ReactNode }[] = [];

  // 지난 단계 요약
  cards.push({ key: "home", node: <p>집 정보와 표준견적서는 끝났어요. 표준견적서 <b className="mj-num">{compare ? won(compare.standard_total) : "—"}</b>(부가세 포함, 업체 견적이 아니에요).</p> });

  // 재재가 먼저 알림(서버가 정한 지금 할 일)
  if (ov.todo?.text) cards.push({ key: "todo", alert: true, node: <p><b>{ov.todo.text}</b></p> });

  if (!vs.length && !deal && closed.length) {
    cards.push({ key: "closed", alert: true, node: <p>{closed.map((v) => v.vendor_name).join(" · ")} 실측 요청은 닫혔어요(거절 · 기한 지남 등). 다른 업체를 담아 다시 물어봐 주세요.</p> });
  }
  if (!vs.length && !deal) {
    const cardsOf = [...(vendors?.local ?? []), ...(vendors?.nearby ?? [])].filter((v) => v.state === "ok");
    const picked = cardsOf.filter((v) => v.shortlisted);
    cards.push({ key: "vendors", node: (
      <>
        <p>이 조건으로 가견적을 낸 업체예요. <b>가견적</b>은 업체가 확인한 단가로 믿집이 계산한 <b>실측 전 금액</b>이에요. 마음에 드는 곳을 담아 주세요.</p>
        <div className={s.vlist}>
          {cardsOf.slice(0, 6).map((v) => (
            <div key={v.vendor_id} className={`${s.vrow} ${v.shortlisted ? s.vrowOn : ""}`}>
              <div><b>{v.name}</b><span className={s.note}>{v.rating ? `별 ${v.rating} · ` : ""}후기 {v.review_count} · 시공 {v.done_count}</span></div>
              <div className={s.row}>
                <b className="mj-num">{v.estimate_total != null ? won(v.estimate_total) : "—"}</b>
                <Button size="sm" variant={v.shortlisted ? "secondary" : "weak"} busy={busy === v.vendor_id}
                  onClick={() => act(v.vendor_id, () => v.shortlisted ? call("DELETE", `/projects/${pid}/shortlist/${enc(v.vendor_id)}?trade=dobae`) : call("POST", `/projects/${pid}/shortlist`, { trade: "dobae", vendor_id: v.vendor_id }))}>
                  {v.shortlisted ? "빼기" : "담기"}
                </Button>
              </div>
            </div>
          ))}
          {!cardsOf.length ? <p className={s.note}>이 지역에 가견적을 낸 업체가 아직 없어요.</p> : null}
        </div>
        {/* 피드백: 재재가 고른 업체만 보이지 않게 전체 목록 길을 늘 둬요 */}
        <div className={s.row}><Button size="sm" variant="secondary" href={`/projects/${pid}/vendors`}>전체 업체에서 직접 고르기</Button></div>
        {picked.length ? <VisitRequest pid={pid} draft={draft} /> : null}
      </>
    ) });
  }

  for (const v of vs) {
    if (v.status === "requested") cards.push({ key: v.id, node: <p><b>{v.vendor_name}</b>에 실측 날짜를 물어봤어요. 업체가 되는 기간을 보내면 먼저 알려 드릴게요. 궁금한 건 <Link href="/chat">업체 채팅</Link>으로 물어보세요.</p> });
    else if (v.status === "offered" || v.status === "proposed") cards.push({ key: v.id, alert: true, node: <PickCard pid={pid} visitId={v.id} name={v.vendor_name} proposal={v.status === "proposed"} busy={busy} act={act} /> });
    else if (v.status === "picked") cards.push({ key: v.id, node: <><p><b>{v.vendor_name}</b>에 고른 날을 보냈어요. 업체가 현장 정보를 보고 수락하면 실측이 확정돼요.</p><p className={s.why}>주차 · 엘리베이터 사정으로 업체가 다른 날을 제안하면 먼저 알려 드릴게요. 그 사이 <Link href="/chat">업체 채팅</Link>으로 주고받을 수 있어요.</p></> });
    else if (v.status === "booked") cards.push({ key: v.id, node: <><p><b>{v.vendor_name}</b> 실측이 잡혔어요. 실측 때 업체가 벽 크기와 상태를 재고 견적서를 보내요.</p><p className={s.why}>실측 전날: 가구 앞 벽이 보이게 비워 두고, 벽지 철거 · 폐기물이 견적에 들어가는지 물어보세요.</p><SiteInfoCard projectId={p.id} /></> });
    else if (v.status === "visited") cards.push({ key: v.id, node: <p><b>{v.vendor_name}</b> 실측을 마쳤어요. 실측 견적서를 기다리고 있어요.</p> });
  }

  const quoted = (compare?.vendors ?? []).filter((r) => r.latest && r.status === "quoted");
  if (quoted.length && !deal) {
    cards.push({ key: "compare", alert: true, node: (
      <>
        <p><b>실측 견적서가 도착했어요.</b> 표준견적서와 먼저 비교해 뒀어요.</p>
        <div className={s.two}>
          {quoted.map((r) => (
            <div key={r.visit_id} className={s.card}>
              <h4>{r.vendor_name}</h4>
              <b className="mj-num">{r.latest!.total != null ? won(r.latest!.total) : "—"}</b>
              <span className={s.note}>실측 견적서 · 확정 전 금액{r.vs_direction !== "same" && vsPct(r.vs_standard, r.vs_direction) ? ` · 표준견적서보다 ${vsPct(r.vs_standard, r.vs_direction)}` : ""}</span>
              {r.estimate_total != null ? <span className={s.note}>가견적(실측 전) {won(r.estimate_total)}</span> : null}
              <Button size="sm" busy={busy === `c${r.visit_id}`} disabled={r.seen_ver == null}
                onClick={() => act(`c${r.visit_id}`, () => call("POST", `/projects/${pid}/quotes/${enc(r.visit_id)}/confirm`, { seen_ver: r.seen_ver }))}>{euro(r.vendor_name)} 확정</Button>
            </div>
          ))}
        </div>
        <p className={s.why}>확정은 직접 눌러요. 확정하면 다른 업체 견적서는 닫혀요. 물어볼 게 있으면 <Link href={`/projects/${pid}/quotes`}>비교 화면</Link>이나 채팅으로요.</p>
      </>
    ) });
  }

  if (deal) {
    const d = deal.deal;
    cards.push({ key: "deal", node: <p><b>{euro(d.vendor_name)}</b> 확정했어요. 확정 금액 <b className="mj-num">{won(d.quote.total)}</b>.</p> });
    if (deal.dates_state === "waiting") cards.push({ key: "dates-wait", node: <p>{iga(d.vendor_name)} 공사 날짜를 올리면 알려 드릴게요.</p> });
    if ((deal.dates_state === "proposed" || deal.dates_state === "change_proposed") && deal.proposal) {
      const x = deal.proposal;
      cards.push({ key: "dates", alert: true, node: (
        <>
          <p><b>{iga(d.vendor_name)} 공사 날짜를 올렸어요.</b> {dateShort(x.start)} ~ {dateShort(x.end)} · {x.workdays}일 · {x.crew}명</p>
          <div className={s.row}><Button size="sm" busy={busy === "accept"} onClick={() => act("accept", () => call("POST", `/projects/${pid}/deals/${enc(d.id)}/dates/${enc(x.id)}/accept`, { seen_version: schedule!.final_version }))}>이 날짜로 수락</Button>
            <Button size="sm" variant="secondary" href={`/projects/${pid}/schedule`}>다른 날짜 요청</Button></div>
        </>
      ) });
    }
    if (deal.dates_state === "scheduled" && d.status === "scheduled") {
      const before = d.start_date && d.start_date > today;
      cards.push({ key: "work", node: before
        ? <><p>공사는 <b>{d.start_date ? dateShort(d.start_date) : ""}</b>에 시작해요. 공사 전에 할 일을 챙겨 주세요. 체크한 건 업체도 봐요.</p>{ov.checks.length ? <PreWorkCheck projectId={p.id} checks={ov.checks} start={d.start_date} /> : null}</>
        : <p>공사 중이에요. 궁금한 건 아래에 물어보거나 업체 채팅으로 물어보세요.</p> });
    }
    const last = d.progress?.[0];
    if (last) {
      cards.push({ key: `pg${last.id}`, node: (
        <>
          <p><b>{iga(d.vendor_name)} {dateShort(last.day)}에 진행 사진을 올렸어요.</b>{last.note ? ` "${last.note}"` : ""}</p>
          <ul className={s.pics} aria-label="공사 진행 사진">
            {last.photos.map((fid, i) => <li key={fid}><img src={donePhotoHref(p.id, d.id, fid)} alt={`진행 사진 ${i + 1}`} loading="lazy" /></li>)}
          </ul>
          {d.progress.slice(1, 4).map((x) => <p key={x.id} className={s.why}>{dateShort(x.day)} · 사진 {x.photos.length}장{x.note ? ` · ${x.note}` : ""}</p>)}
        </>
      ) });
    }
    // 최신 판만 · 물어본 것(asked)도 아직 답할 수 있어요
    for (const x of deal.extras.items.filter((i) => (i.answer === "pending" || i.answer === "asked") && !i.superseded)) {
      cards.push({ key: `x${x.id}`, alert: true, node: (
        <>
          <p><b>{iga(d.vendor_name)} 추가 금액을 요청했어요.</b> {x.title} · <b className="mj-num">{won(x.total)}</b></p>
          <p className={s.why}>이유: {x.reason.replace(/[.。]\s*$/, "")}. 승인해야 금액에 더해져요. 설명이 더 필요하면 &quot;물어볼래요&quot;로 채팅에서 물어보세요.</p>
          <div className={s.row}>
            <Button size="sm" busy={busy === `xa${x.id}`} onClick={() => act(`xa${x.id}`, () => call("POST", `/projects/${pid}/deals/${enc(d.id)}/extras/${enc(x.id)}/answer`, { answer: "approve" }))}>승인</Button>
            <Button size="sm" variant="secondary" busy={busy === `xr${x.id}`} onClick={() => act(`xr${x.id}`, () => call("POST", `/projects/${pid}/deals/${enc(d.id)}/extras/${enc(x.id)}/answer`, { answer: "reject" }))}>거절</Button>
            {x.answer === "asked" ? <span className={s.note}>채팅으로 물어봤어요</span> : <Button size="sm" variant="weak" busy={busy === `xq${x.id}`} onClick={() => act(`xq${x.id}`, () => call("POST", `/projects/${pid}/deals/${enc(d.id)}/extras/${enc(x.id)}/answer`, { answer: "ask" }))}>물어볼래요</Button>}
          </div>
        </>
      ) });
    }
    if (d.status === "checking") {
      cards.push({ key: "check", alert: true, node: (
        <>
          <p><b>{iga(d.vendor_name)} 공사를 마쳤다고 올렸어요.</b> 완료를 누르기 전에 같이 확인해요.</p>
          <ul className={s.auto}><li>벽지가 들뜨거나 운 곳이 없는지</li><li>이음매가 벌어지지 않았는지</li><li>모서리 · 콘센트 둘레가 깔끔한지</li><li>몰딩 · 걸레받이와 벽지 사이가 뜨지 않았는지</li></ul>
          <div className={s.row}>
            <Button size="sm" busy={busy === "done"} onClick={() => act("done", () => call("POST", `/projects/${pid}/deals/${enc(d.id)}/check`, { result: "done" }))}>확인했어요, 완료</Button>
            <Button size="sm" variant="secondary" href={`/projects/${pid}/schedule`}>고칠 곳이 있어요</Button>
          </div>
        </>
      ) });
    }
    if (d.status === "done") cards.push({ key: "review", node: d.review_open ? <ReviewCard pid={pid} dealId={d.id} name={d.vendor_name} busy={busy} act={act} /> : <p>리뷰까지 마쳤어요. 하자가 보이면 {d.vendor_name}에 채팅으로 알려 주세요. 수고 많으셨어요.</p> });
  }

  const auto: Record<number, string[]> = { 0: ["집 정보 정리"], 1: ["표준견적서 계산"], 2: vs.length ? ["업체에 실측 날짜 물어보기"] : [], 4: quoted.length ? ["견적서를 표준견적서와 비교"] : [], 5: deal ? ["확정 공정표 만들기"] : [] };
  const terms = ["실크 벽지", "가견적", "실측 견적서", "보양", "하자담보책임기간"].map((n) => termByName(n)).filter((t) => t !== undefined);
  // 입력칸 위 질문 버튼(#180): 마지막 답의 추천 질문, 없으면 지금 칸의 시작 질문. 물은 건 빼요
  const lastOut = [...asks].reverse().find((a) => a.out)?.out ?? null;
  const quick = quickChips(now, asks.filter((a) => !a.err).map((a) => a.q), lastOut?.answer.suggest ?? null); // 오류로 끝난 질문은 다시 누를 수 있게 남겨요
  // 사진 · 문서 버튼(#181 1단계): 재재는 아직 사진을 보지 않아서, 사진을 받는 업체 채팅으로 이어 줘요
  // 채팅 id는 요청 목록(visits)이 아니라 요청판(board) 줄에 있어요. 닫힌 요청은 빼요
  const boardOpen = (visits?.board ?? []).filter((r) => !CLOSED.includes(r.status)).map((r) => ({ vendor_name: r.vendor_name, thread_id: r.thread_id ?? null }));
  const targets = attachTargets(deal ? { vendor_name: deal.deal.vendor_name, thread_id: deal.deal.thread_id ?? null } : null, boardOpen);

  return (
    <div className={s.page}>
      <div className={s.chips} aria-label="모은 조건">
        <span className={`${s.chip} ${s.chipOn}`}>집<b>아파트 · {p.emd ?? p.sgg}</b></span>
        <span className={`${s.chip} ${s.chipOn}`}>공정<b>도배 {p.scope === "partial" ? "부분" : "전체"}</b></span>
        <span className={`${s.chip} ${s.chipOn}`}>거주<b>{p.occupied ? "살고 있어요" : "빈 집"}</b></span>
        <span className={`${s.chip} ${s.chipOn}`}>도배 유형<b>{p.grade === "economy" ? "저가형" : "기본형"}</b></span>
        <Link className={s.chip} href={`/projects/${pid}?tab=log`}>결정 기록<b>보기</b></Link>
      </div>
      <button type="button" className={s.planBar} aria-expanded={open} onClick={() => setOpen((v) => !v)}><b>{Math.min(now + 1, 8)}/8 · 내 도배 플랜</b><span>{open ? "접기" : "보기"}</span></button>
      <div className={s.body}>
        <section className={s.chat} aria-label="재재와 대화">
          <div className={s.msgs} role="log" aria-live="polite">
            {cards.map((c) => (
              <div key={c.key} className={`${s.bot} ${c.alert ? s.alert : ""}`}>
                <div className={s.face}><Jaejae mouth={c.alert ? "open" : "smile"} /></div>
                <div className={s.bubble}><span className={s.who}>{c.alert ? "재재 · 먼저 알려 드려요" : "재재 · 믿집 비서"}</span>{c.node}</div>
              </div>
            ))}
            {err ? <p className="mj-error" role="alert">{err}</p> : null}
            {note ? <p className="mj-error" role="status">{note}</p> : null}
            {asks.map((a, i) => (
              <div key={`a${i}`} className={s.msgs} style={{ padding: 0 }}>
                <p className={s.me}>{a.q}</p>
                {a.pics?.length ? <ul className={s.sentPics} aria-label={`보낸 사진 ${a.pics.length}장`}>{a.pics.map((src) => <li key={src}><img src={src} alt="" /></li>)}</ul> : null}
                <div className={s.bot}><div className={s.face}><Jaejae mouth={a.out ? "smile" : "flat"} /></div><div className={s.bubble}><span className={s.who}>재재</span>
                  {a.out ? <AiAnswer answer={a.out.answer} projectId={p.id} onPick={(q, b) => void ask(q, b ?? null)} /> : a.err ? <p className="mj-error">{a.err}</p> : <p className={s.typing}>줄자로 재는 중…</p>}</div></div>
              </div>
            ))}
          </div>
          <div className={s.dock}>
            {quick.length ? (
              <div className={s.quick} role="group" aria-label="이런 걸 물어보세요">
                {quick.map((q) => <button key={q} type="button" className={s.chip} disabled={asking} onClick={() => void ask(q)}>{q}</button>)}
              </div>
            ) : null}
            <div id="pflow-attach" className={s.attach} role="group" aria-label="사진 보내기" hidden={!attach}>
              {targets.length ? targets.map((t) => <Button key={t.href} size="sm" variant="weak" href={t.href}>{t.label}</Button>)
                : <p className={s.note}>{vs.length ? "업체와 실측 날짜가 확정되면 그 업체 채팅에서 사진을 보낼 수 있어요." : "업체에 실측을 요청할 때 집 사진을 붙여 보낼 수 있어요. 실측 날짜가 확정되면 그 업체 채팅에서도 보낼 수 있어요."}</p>}
              <div className={s.row}>
                <Button size="sm" variant="weak" disabled={picBusy || asking || pics.length >= PHOTO_MAX} onClick={() => picIn.current?.click()}>{picBusy ? "올리는 중" : "재재에게 사진으로 물어보기"}</Button>
                <input ref={picIn} type="file" accept="image/*" multiple hidden aria-label="재재에게 보낼 사진 고르기"
                  onChange={(e) => { const f = Array.from(e.currentTarget.files ?? []); e.currentTarget.value = ""; if (f.length) void addPics(f); }} />
              </div>
              {pics.length ? (
                <ul className={s.picks} aria-label="붙인 사진">
                  {pics.map((x) => (
                    <li key={x.id}><img src={x.src} alt={x.name} /><button type="button" aria-label={`${x.name} 빼기`} disabled={asking} onClick={() => { URL.revokeObjectURL(x.src); setPics((l) => l.filter((y) => y.id !== x.id)); }}>빼기</button></li>
                  ))}
                </ul>
              ) : null}
              {picErr ? <p className="mj-error" role="alert">{picErr}</p> : null}
              <p className={s.note}>얼굴 · 동 · 호수 · 택배 송장은 가리고 올려 주세요. 사진만으로는 정확하지 않아서, 재재는 보이는 것만 알려 드려요. 사진은 한 번에 {PHOTO_MAX}장까지예요.</p>
            </div>
            <form className={s.input} onSubmit={(e) => { e.preventDefault(); void ask(text, null, true); }}>
              <button type="button" className={s.clip} aria-expanded={attach} aria-controls="pflow-attach" onClick={() => setAttach((v) => !v)}>사진</button>
              <label className="mj-sr" htmlFor="pflow-in">재재에게 물을 말</label>
              <textarea id="pflow-in" rows={1} maxLength={1000} value={text} placeholder="궁금한 걸 물어보세요. 예: 가견적이 비싼데 줄일 방법 없을까요?" onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void ask(text, null, true); } }} />
              <Button type="submit" disabled={(!text.trim() && !pics.length) || asking || picBusy}>{asking ? "답 기다리는 중" : "보내기"}</Button>
            </form>
          </div>
          {/* 새 말이 오면 여기까지 내려요. 입력칸(dock) 뒤에 두어 마지막 말풍선이 입력칸에 가려지지 않아요 */}
          <div ref={end} />
        </section>
        <Plan now={now} scope={p.id} open={open} auto={auto}
          render={(step) => step === 0 ? <><Link href={`/start?edit=${pid}`}>기본 정보 고치기{p.locked ? " (요청 뒤라 잠겼어요)" : ""}</Link><SiteInfoCard projectId={p.id} /></>
            : step === 1 ? <Link href={`/projects/${pid}/standard`}>표준견적서 보기 · {compare ? won(compare.standard_total) : "—"}</Link>
            : step === 2 ? <Link href={`/projects/${pid}/vendors`}>전체 업체에서 직접 고르기</Link>
            : step === 3 ? <Link href={`/projects/${pid}/visits`}>실측 일정 보기</Link>
            : step === 4 ? <Link href={`/projects/${pid}/quotes`}>견적서 비교 화면</Link>
            : step === 5 || step === 6 ? <>{ov.checks.length ? <PreWorkCheck projectId={p.id} checks={ov.checks} start={deal?.deal.start_date ?? null} /> : null}<Link href={`/projects/${pid}/plan`}>공정표 보기</Link></>
            : <Link href={`/projects/${pid}/schedule`}>공사 끝 확인 · 리뷰</Link>}
        />
      </div>
      <div className={s.chips} aria-label="믿집 백과">
        {terms.map((t) => <Link key={t.id} className={s.chip} href={termHref(t)}>백과<b>{t.term}</b></Link>)}
      </div>
    </div>
  );
}

type Act = (key: string, fn: () => Promise<unknown>) => Promise<void>;

// 2026-11-25 회의: 채팅에는 입력 칸을 두지 않아요. 날짜는 요청 화면에서 업체가 등록한 영업일로 골라요
function VisitRequest({ pid, draft }: { pid: string; draft: VisitDraft | null }) {
  const n = draft?.vendors.length ?? 0;
  return (
    <div className={s.card}>
      <h4>실측 날짜 고르기</h4>
      <p className={s.note}>담은 업체 {n}곳이 등록해 둔 영업일에서 실측 반나절을 골라 요청해요. 업체는 주차 · 엘리베이터 같은 현장 정보를 보고 수락하거나 다른 날을 제안해요.</p>
      <Button size="sm" href={`/projects/${pid}/visits/new`}>영업일 보고 실측 요청하기</Button>
    </div>
  );
}

function PickCard({ pid, visitId, name, proposal, busy, act }: { pid: string; visitId: string; name: string; proposal: boolean; busy: string | null; act: Act }) {
  const [pick, setPick] = useState<Pick | null>(null);
  const [failed, setFailed] = useState(false);
  const [sel, setSel] = useState<{ day: string; half: Half } | null>(null);
  useEffect(() => { void call<Pick>("GET", `/projects/${pid}/visits/${enc(visitId)}`).then(setPick).catch(() => setFailed(true)); }, [pid, visitId]);
  const days = (pick?.days ?? []).filter((d) => d.am || d.pm).slice(0, 14);
  return (
    <>
      <p><b>{iga(name)} 실측 되는 날을 보냈어요.</b> 집에 계실 반나절을 골라 주세요.</p>
      <div className={s.vlist}>
        {days.map((d) => (
          <div key={d.day} className={s.vrow}><b>{dateShort(d.day)}</b><div className={s.row}>
            {(["am", "pm"] as Half[]).filter((h) => d[h]).map((h) => (
              <Button key={h} size="sm" aria-pressed={sel?.day === d.day && sel.half === h} variant={sel?.day === d.day && sel.half === h ? "primary" : "weak"} onClick={() => setSel({ day: d.day, half: h })}>{HALF[h]}</Button>
            ))}
          </div></div>
        ))}
        {failed ? <p className={s.note}>고를 수 있는 날을 불러오지 못했어요. <Link href={`/projects/${pid}/visits/${enc(visitId)}`}>실측 화면</Link>에서 봐 주세요.</p> : null}
        {pick && !days.length ? <p className={s.note}>고를 수 있는 반나절이 없어요. <Link href={`/projects/${pid}/visits/${enc(visitId)}`}>실측 화면</Link>에서 다시 물어보세요.</p> : null}
      </div>
      <Button size="sm" disabled={!sel} busy={busy === `p${visitId}`} onClick={() => sel && act(`p${visitId}`, () => call("POST", `/projects/${pid}/visits/${enc(visitId)}/${proposal ? "proposal/pick" : "pick"}`, sel))}>
        {sel ? `${dateShort(sel.day)} ${euro(HALF[sel.half])} 보내기` : "반나절을 골라 주세요"}
      </Button>
    </>
  );
}

function ReviewCard({ pid, dealId, name, busy, act }: { pid: string; dealId: string; name: string; busy: string | null; act: Act }) {
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  return (
    <>
      <p><b>공사를 완료했어요.</b> 수고 많으셨어요. {name} 리뷰를 남기면 다음 고객이 업체를 고를 때 도움이 돼요.</p>
      <div className={s.row}>{[5, 4, 3, 2, 1].map((n) => <Button key={n} size="sm" aria-pressed={rating === n} variant={rating === n ? "primary" : "weak"} onClick={() => setRating(n)}>별 {n}개</Button>)}</div>
      {rating ? <label className={s.field}>리뷰 글(선택)<textarea rows={3} maxLength={500} value={body} placeholder="예: 약속한 날에 깔끔하게 마무리해 주셨어요." onChange={(e) => setBody(e.target.value)} /></label> : null}
      <Button size="sm" disabled={!rating} busy={busy === "review"} onClick={() => act("review", () => call("POST", `/projects/${pid}/deals/${enc(dealId)}/review`, { rating, tags: [], body: body.trim() || null, photo_file_ids: [] }))}>리뷰 등록</Button>
    </>
  );
}
