"use client";
// /projects/{id}/assistant(시연 영상 11~48장면): 서버 상태를 읽어 왼쪽 대화에 지금 단계를 알리고, 고르기 · 단추는 오른쪽 보드(내 도배 플랜)에 둬요.
// #196(멘토 피드백 · 2026-11-25 회의 '채팅에 폼 없음'): 대화에는 글과 '플랜에서 보기' 링크만(폰은 플랜이 대화 위에 열려서 '오른쪽'이라 하지 않아요), 입력은 글뿐이에요.
//   보드에서 처리하면 대화에 결과 한 줄이 붙어요. 표준견적서는 페이지를 옮기지 않고 큰 창(StandardDialog)으로 바로 열려요.
// 보드 단추가 부르는 API(그대로예요):
// - 업체 담기 POST · DELETE /projects/{id}/shortlist · 반나절 고르기 POST …/visits/{vid}/pick(제안이면 proposal/pick)
// - 견적서 확정 POST …/quotes/{vid}/confirm · 공사 날짜 수락 POST …/deals/{did}/dates/{pid}/accept · 추가 금액 POST …/extras/{eid}/answer
// - 공사 끝 확인 POST …/deals/{did}/check · 준비 체크 PUT /projects/{id}/checks/{key}. 실측 요청 · 리뷰는 각 화면으로 가요.
// #197(멘토 피드백 '오른쪽 패널과 채팅이 유기적으로'): AI 답에 나온 업체 이름은 보드 업체 칸에서 강조하고, 일정 답이면 일정 칸으로 옮겨요.
//   업체 칸은 공정별 탭(도배 · 목공, 목공은 고른 공사만)과 찾기 칸이 있고, 공정마다 3곳까지 담아요(서버도 slots_full 409로 막아요).
//   AI 카드 모양은 그대로예요. 강조는 답 글 · 표 · 초안에 나온 이름을 이 공사 업체 목록과 맞춰 봐요(화면에서만).
// 2026-11-26 팀 피드백: 위 칩 줄을 빼고(결정 기록 · 서류는 플랜 머리로), 실측 반나절은 달력으로, 실측을 기다리는 동안 할 거리 카드,
//   목공도 담은 업체에 실측을 요청해요(견적서 비교 · 확정 · 공사 일정은 아직 도배만).
// 2026-11-26 사용자: 업체 담기 · 실측 요청 · 표준견적서도 이 화면 안에서. 업체 보기 · 실측 요청 · 표준견적서 화면은 여기로 넘어와요
//   (보드 업체 칸 · 실측 칸(BoardVisitRequest) · 표준견적서 창). 업체 이름을 누르면 업체 자세히(리뷰 · 사례) 화면이에요.
// - 질문은 POST /ai/turns(로그인한 고객 AI). 금액 · 날짜는 API 값 그대로이고, 저장 · 확정 · 승인은 사람이 보드 단추를 눌러요.
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AiAnswer } from "@/components/ai/AiAnswer";
import { vsPct } from "@/components/compare/text";
import { PreWorkCheck } from "@/components/project/PreWorkCheck";
import { donePhotoHref } from "@/components/schedule/v3text";
import { Button } from "@/components/ui/Button";
import { gwaWa, iGa as iga } from "@/components/vendors/text";
import { askAi, newClientKey, type AiButton, type AiTurnOut } from "@/lib/api/chat";
import type { ApiCompare, ApiOverview, ApiSchedule } from "@/lib/api/schedule";
import type { ProjectVendors, ProjectVisits, VisitDraft, VisitProject } from "@/lib/api/visit";
import { call, errorText, type Schemas } from "@/lib/backend/client";
import { dateShort, euro, won } from "@/lib/format";
import { termByName } from "@/lib/guide";
import { boardTarget, norm, pickRule, type PickState } from "./boardLink";
import { quickChips } from "./chips";
import { Jaejae } from "./Jaejae";
import { MOK_TODO, Plan, PLAN_STEPS } from "./Plan";
import { BoardVisitRequest } from "./BoardVisitRequest";
import { StandardDialog, type StdData } from "./StandardDialog";
import { VendorDialog, type VendorOpen } from "./VendorDialog";
import { Reselect } from "@/components/confirm/Reselect";
import { CancelSheet } from "@/components/visit/CancelSheet";
import { HalfCalendar } from "@/components/visit/HalfCalendar";
import { Windows, type Win, type WinData } from "./Windows";
import { SiteInfoCard } from "@/components/project/SiteInfoCard";
import { AiActionContext } from "@/components/ai/AiAnswer";
import s from "./flow.module.css";

type Pick = Schemas["VisitPickOut"];
const CLOSED = ["declined", "expired", "cancelled", "no_show", "closed"];
type Half = "am" | "pm";
const HALF: Record<Half, string> = { am: "오전", pm: "오후" };
const enc = encodeURIComponent;
type Trade = "dobae" | "mokgong";
const TRADE_WORD: Record<Trade, string> = { dobae: "도배", mokgong: "목공" };
const MAX_PICK = 3;
export type FlowData = {
  p: VisitProject;
  ov: ApiOverview;
  compare: ApiCompare | null;
  schedule: ApiSchedule | null;
  visits: ProjectVisits | null;
  vendors: ProjectVendors | null;
  draft: VisitDraft | null;
  /** 목공 실측 요청 초안(목공을 고른 공사만, 아니면 null) */
  mokDraft: VisitDraft | null;
  /** 목공 업체 목록(목공을 고른 공사만, 아니면 null) */
  mokVendors: ProjectVendors | null;
  /** 목공 실측 요청(목공을 고른 공사만, 담기 · 빼기 막을 때 봐요) */
  today: string;
  /** 표준견적서 창 값(서버가 읽어 넘겨요). 못 읽으면 표준견적서 화면 링크로 가요 */
  std: StdData | null;
  /** 만든 바로 뒤(?open=standard)면 표준견적서 창을 열고 시작해요 */
  openStd: boolean;
  /** 다른 화면에서 넘어올 때 열 보드 칸(?step=2 업체 · 3 실측). 업체 보기 · 실측 요청 화면은 이 화면으로 와요(2026-11-26) */
  step: number | null;
  /** 창에 쓰는 값: 기본 정보 고치기(지역 · 저장된 답 · 잠김) · 공정표 · 공사 전 체크(서버가 읽어 넘겨요) */
  win: { regions: WinData["regions"]; draft: WinData["draft"]; plan: WinData["plan"]; checks: WinData["checks"] };
};

/** 서버 상태 → 플랜 8칸 지금 칸 */
/** 보드 지금 칸(0~7, 다 끝나면 8): 서버 공정별 단계(overview.trades, #203)를 그대로 써요. 위 띠 · 내 공사 목록과 같은 값 */
function stepOf(d: FlowData, trade = "dobae"): number {
  const t = d.ov.trades.find((x) => x.trade === trade);
  if (t) return t.steps.length && t.steps.every((st) => st.state === "done") ? 8 : Math.max(0, t.current - 1);
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
  const { p, ov, compare, schedule, visits, vendors, mokVendors, draft, mokDraft, today, std } = data;
  const pid = enc(p.id);
  // 공정 탭(2026-11-27 사용자): 공정이 둘 이상이면 탭마다 대화 · 보드 · 표준견적서를 따로 보여요. 고른 탭은 주소(?trade=)에 둬서 위 띠와 같이 써요
  const sp = useSearchParams();
  const pathname = usePathname();
  const tradeKeys = (["mokgong", "dobae"] as Trade[]).filter((t) => ov.trades.some((x) => x.trade === t));
  const multi = tradeKeys.length > 1;
  const want = sp.get("trade");
  const active: Trade = tradeKeys.includes(want as Trade) ? (want as Trade) : tradeKeys.includes("dobae") ? "dobae" : (tradeKeys[0] ?? "dobae");
  const isMok = active === "mokgong";
  // 주소만 바꿔요(서버에서 화면 값을 다시 읽지 않아 탭이 바로 바뀌어요). useSearchParams가 따라와요
  const pickTrade = (t: Trade) => window.history.replaceState(null, "", `${pathname}?trade=${t}`);
  const now = stepOf(data, active);
  // 보드 칸 주소(?step, 옛 업체 · 실측 화면에서 넘어옴)로 오면 폰에서도 플랜을 펼쳐 그 칸을 바로 보여요(#221 리뷰)
  const [open, setOpen] = useState(data.step != null);
  const [tab, setTab] = useState(data.step ?? Math.min(now, 7));
  const [stdOpen, setStdOpen] = useState(data.openStd && !!std);
  const [trade, setTrade] = useState<Trade>("dobae");
  const [query, setQuery] = useState("");
  /** AI 답에 나온 업체(보드에서 강조) */
  const [hi, setHi] = useState<string[]>([]);
  /** 업체 자세히 창(보드에서 업체 이름을 누르면) */
  const [vOpen, setVOpen] = useState<VendorOpen>(null);
  /** 재재 화면 창(기본 정보 · 공정표 · 채팅 · 리뷰 · 공사 일정 · 용어). 다른 화면으로 옮기지 않아요 */
  const [win, setWin] = useState<Win>(null);
  /** 실측 요청 · 실측 취소 창(UC-VND-06) */
  const [cancel, setCancel] = useState<{ id: string; name: string; request: boolean } | null>(null);
  const [busyKey, setBusy] = useState<string | null>(null);
  const [refreshing, startRefresh] = useTransition();
  // 새 화면 값이 올 때까지 단추를 막아요(같은 요청을 두 번 보내 409가 나지 않게)
  const busy = busyKey ?? (refreshing ? "refresh" : null);
  const [err, setErr] = useState<string | null>(null);
  /** 보드에서 처리한 결과 한 줄(대화에 붙어요) */
  const [doneAll, setDoneAll] = useState<{ text: string; trade: Trade }[]>([]);
  const done = doneAll.filter((d) => d.trade === active).map((d) => d.text);
  /** 보드에서 처리한 결과 줄은 그 일을 한 공정 탭에만 보여요 */
  const setDone = (fn: (x: string[]) => string[]) => setDoneAll((all) => {
    const mine = all.filter((d) => d.trade === active).map((d) => d.text);
    const next = fn(mine);
    return [...all.filter((d) => d.trade !== active), ...next.map((text) => ({ text, trade: active }))];
  });
  // 재재와 나눈 말은 공정 탭마다 따로(탭을 바꿔도 남아요)
  /** to: 이 답으로 고른 보드 칸(폰에서 '플랜에서 보기' 링크) */
  type Ask = { q: string; out?: AiTurnOut; err?: string; to?: number };
  const [asksBy, setAsksBy] = useState<Partial<Record<Trade, Ask[]>>>({});
  const asks = asksBy[active] ?? [];
  const setAsks = (fn: (a: Ask[]) => Ask[]) => setAsksBy((m) => ({ ...m, [active]: fn(m[active] ?? []) }));
  const [chatIds, setChatIds] = useState<Partial<Record<Trade, string>>>({});
  const chatId = chatIds[active] ?? null;
  const setChatId = (id: string) => setChatIds((m) => ({ ...m, [active]: id }));
  // 탭을 바꾸면 보드의 업체 · 실측 칸도 그 공정으로
  useEffect(() => { setTrade(active); }, [active]);
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);
  // 보드 칸 주소로 넘어온 첫 화면은 대화 끝으로 내리지 않아요(폰에서 위에 펼친 플랜이 가려져요). 묻거나 처리하면 다시 내려요
  const toPlanFirst = useRef(data.step != null);
  useEffect(() => {
    if (toPlanFirst.current && !asks.length && !done.length) { window.scrollTo(0, 0); return; }
    toPlanFirst.current = false;
    end.current?.scrollIntoView({ block: "end" });
  }, [asks.length, now, done.length]);
  // 비교 칸에서 재재가 말한 업체가 보이게 옮겨요(업체 칸은 VendorRows가 옮겨요)
  useEffect(() => {
    if ((tab === 3 || tab === 4) && hi.length) requestAnimationFrame(() => document.querySelector("#jj-board [data-hi]")?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  }, [tab, hi]);
  // 주소로 넘어온 값(?step 보드 칸 · ?open=standard 표준견적서 창)은 여기 한 곳에서 적용해요(#221 리뷰).
  // 재재 화면에 있는 채로 이런 주소로 다시 오면 화면을 새로 만들지 않아 useState 처음 값이 안 바뀌어요. 그래서 값이 바뀔 때마다
  // 그 칸 · 창을 열고(폰은 플랜을 펼쳐요), 지금 단계 자동 이동이 덮지 않게 맞춘 뒤, 주소를 정리해요(새로고침 · 뒤로 가기에 다시 열리지 않게)
  const lastNow = useRef(now);
  const cameKey = data.step != null || data.openStd ? JSON.stringify([data.step, data.openStd]) : "";
  useEffect(() => {
    if (!cameKey) return;
    lastNow.current = now;
    if (data.step != null) {
      setTab(data.step);
      setOpen(true);
      requestAnimationFrame(() => document.getElementById("jj-board")?.scrollIntoView({ block: "start" }));
    }
    if (data.openStd && std) setStdOpen(true);
    router.replace(`/projects/${pid}/assistant${multi ? `?trade=${active}` : ""}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 넘어온 값(cameKey)이 바뀔 때만
  }, [cameKey]);
  // 단계가 넘어가면 보드도 지금 단계로 옮겨요. 지금 칸 값이 실제로 바뀔 때만(개발 모드 StrictMode는 effect를 두 번 돌려서 '처음 한 번 건너뛰기'로는 넘어온 칸이 지워져요)
  useEffect(() => { if (lastNow.current === now) return; lastNow.current = now; setTab(Math.min(now, 7)); }, [now]);

  /** 대화의 '오른쪽에서 보기': 보드를 그 단계로 바꾸고(폰은 펼쳐) 그 자리로 옮겨요 */
  function toBoard(step: number) {
    setTab(step);
    setOpen(true);
    requestAnimationFrame(() => document.getElementById("jj-board")?.scrollIntoView({ block: "start", behavior: "smooth" }));
  }

  const listOf = (t: Trade) => { const x = t === "dobae" ? vendors : mokVendors; return [...(x?.local ?? []), ...(x?.nearby ?? [])]; };
  /** 담기 · 빼기를 열지(#220 리뷰): 업체 목록은 재재가 말하면 확정 뒤에도 보여서, 단추는 그 공정 확정 · 실측 상태로 따로 막아요 */
  const pickOf = (t: Trade): PickState => {
    const tv = visits?.visits.filter((v) => v.trade === t && !CLOSED.includes(v.status)) ?? [];
    const x = t === "dobae" ? vendors : mokVendors;
    return {
      locked: !!schedule?.trades.some((d) => d.deal.trade === t) || tv.some((v) => v.status === "chosen"),
      left: x?.shortlist?.left ?? MAX_PICK - listOf(t).filter((v) => v.shortlisted).length,
      live: new Set(tv.flatMap((v) => (v.vendor_id ? [v.vendor_id] : []))),
    };
  };
  /** AI 답 → 보드(#197, boardLink.ts): 업체 이름이면 그 업체 강조, 아니면 물은 말로 일정 · 업체 칸 */
  function linkBoard(q: string, out: AiTurnOut): number | undefined {
    // 견적서를 낸 업체는 업체 목록에 없을 수도 있어 비교 줄 이름도 같이 봐요
    // 도배 업체 상태: 견적서를 보냄(비교 칸) · 실측 진행 중(실측 칸)
    const got = new Set((compare?.vendors ?? []).filter((r) => r.latest && r.status === "quoted" && r.vendor_id).map((r) => r.vendor_id!));
    const going = new Set(vs.flatMap((v) => (v.vendor_id ? [v.vendor_id] : [])));
    const stage = (id: string) => (got.has(id) ? "quoted" as const : going.has(id) ? "visit" as const : undefined);
    const sent = (compare?.vendors ?? []).flatMap((r) => (r.vendor_id ? [{ vendor_id: r.vendor_id, name: r.vendor_name, trade: "dobae" as Trade, stage: stage(r.vendor_id) }] : []));
    const names = [...(["dobae", "mokgong"] as Trade[]).flatMap((t) => listOf(t).map((v) => ({ vendor_id: v.vendor_id, name: v.name, trade: t, stage: t === "dobae" ? stage(v.vendor_id) : undefined }))), ...sent];
    const to = boardTarget(q, out.answer, names, { quoted: got.size > 0, deal: !!deal, chosen: vs.length > 0 }); // 비교 칸 · 실측 칸 · 공정표는 도배 기준
    if (!to) return undefined;
    setTab(to.tab);
    setHi(to.hi);
    if (to.hi.length) setQuery("");
    if (to.trade && (to.trade === "dobae" || mokVendors)) setTrade(to.trade);
    setOpen(true); // 폰 · 태블릿은 플랜을 펼쳐요(대화 위에 열려 읽던 답은 그대로예요)
    return to.tab;
  }

  /** AI 답 버튼(표준견적서 · 공정표 · 업체 · 실측 · 견적서)을 이 화면 창 · 보드로 열어요. '?동작'은 열 수 있는지만 물어요 */
  function onAiAction(a: string): boolean {
    const dry = a.startsWith("?");
    const k = dry ? a.slice(1) : a;
    const run: Record<string, () => void> = {
      standard: () => (std ? setStdOpen(true) : toBoard(1)),
      plan: () => setWin({ kind: "plan" }),
      vendors: () => toBoard(2),
      visits_new: () => toBoard(3), visits: () => toBoard(3), calendar: () => toBoard(3),
      quotes: () => toBoard(4),
    };
    if (!run[k]) return false;
    if (!dry) run[k]();
    return true;
  }

  /** said: 처리 결과 한 줄. 서버 결과를 보고 정해야 하면 함수로 줘요(null이면 안 붙여요, 예: 실측 요청 일부 실패) */
  async function act(key: string, fn: () => Promise<unknown>, said?: string | ((out: unknown) => string | null)) {
    if (busy) return;
    setBusy(key);
    setErr(null);
    try {
      const out = await fn();
      const line = typeof said === "function" ? said(out) : said;
      if (line) setDone((x) => [...x, line]);
      startRefresh(() => router.refresh());
    } catch (e) { setErr(errorText(e)); } finally { setBusy(null); }
  }

  const asking = asks.length > 0 && !asks[asks.length - 1].out && !asks[asks.length - 1].err;
  async function ask(q: string, button: AiButton | null = null, fromInput = false) {
    const t = q.trim().slice(0, 1000);
    if (!t || asking) return; // 답을 기다리는 동안 새 질문을 막아요(답이 엇갈리지 않게 · 대화 하나로)
    if (fromInput) setText(""); // 입력칸에서 보낼 때만 비워요(질문 버튼은 글이 같아도 쓰던 글을 남겨요)
    setAsks((a) => [...a, { q: t }]);
    try {
      const out = await askAi({ client_key: newClientKey(), text: t, chat_id: chatId, context: { screen: now <= 2 ? "vendors" : now <= 4 ? "quotes" : "plan", project_id: p.id, ids: [] }, button }); // 선택지의 길(route) · 칸 정보를 그대로 넘겨요
      if (out.chat_id) setChatId(out.chat_id);
      const to = linkBoard(t, out);
      setAsks((a) => a.map((x, i) => (i === a.length - 1 ? { ...x, out, to } : x)));
    } catch (e) {
      setAsks((a) => a.map((x, i) => (i === a.length - 1 ? { ...x, err: errorText(e) } : x)));
    }
  }

  const deal = schedule?.trades.find((t) => t.deal.trade === "dobae") ?? null;
  const all = (visits?.visits ?? []).filter((v) => v.trade === "dobae");
  // 닫힌 요청(거절 · 기한 지남 · 취소 · 안 옴 · 다시 고름)은 진행 중이 아니에요
  const vs = all.filter((v) => !CLOSED.includes(v.status));
  // 목공 실측(팀 피드백 5): 목공을 고른 공사만. 견적서 비교 · 확정은 아직 도배만이라 실측 칸까지만 보여요
  const mvs = mokVendors ? (visits?.visits ?? []).filter((v) => v.trade === "mokgong" && !CLOSED.includes(v.status)) : [];
  // 대화 카드는 고른 공정 탭 것만(공정이 하나면 그대로)
  const both = multi ? (isMok ? mvs : vs) : [...vs, ...mvs];
  const showDobae = !multi || !isMok;
  const showMok = !multi || isMok;
  // 공정별 표준견적서 금액(시장 단가 견적의 그 공정 합계). 없으면 전체 금액
  const stdParts = multi && std?.parts && std.parts.parts.length > 1 ? std.parts : null;
  const tradeStd = stdParts?.parts.find((x) => x.trade === active)?.quote.total ?? null;
  const mokPicked = listOf("mokgong").filter((v) => v.state === "ok" && v.shortlisted);
  const closed = all.filter((v) => CLOSED.includes(v.status));
  const ready = [...(vendors?.local ?? []), ...(vendors?.nearby ?? [])].filter((v) => v.state === "ok");
  const picked = ready.filter((v) => v.shortlisted);
  // 재재가 말한 업체(hi)를 앞으로
  const quoted = (compare?.vendors ?? []).filter((r) => r.latest && r.status === "quoted")
    .sort((a, b) => Number(!!b.vendor_id && hi.includes(b.vendor_id)) - Number(!!a.vendor_id && hi.includes(a.vendor_id)));
  const extras = deal ? deal.extras.items.filter((i) => (i.answer === "pending" || i.answer === "asked") && !i.superseded) : [];
  // 표준견적서 금액은 창 · 비교 칸과 같은 값 하나(업체 견적서 시장 단가, #207). 부분 공사처럼 없을 때만 기존 표준견적서
  // 공정이 둘 이상이면 공종별 표준견적서를 합친 금액(서버 합계)
  const stdTotal = std ? (std.parts && std.parts.parts.length > 1 ? std.parts.total : std.market?.total ?? std.view.sum?.total ?? std.view.total) : compare?.standard_total ?? null;
  const toPick = both.filter((v) => v.status === "offered" || v.status === "proposed");
  // 업체 답 · 실측 · 견적서를 기다리기만 하는 때(고를 것 · 볼 견적서 · 확정이 없을 때): 기다리는 동안 할 거리를 보여요(팀 피드백 4)
  const waiting = !deal && !toPick.length && !quoted.length && both.some((v) => ["requested", "picked", "booked", "visited"].includes(v.status));
  const go = (step: number, label = "플랜에서 보기") => (
    <button type="button" className={s.boardLink} onClick={() => toBoard(step)}>{label} · {PLAN_STEPS[step]} 칸</button>
  );

  // ── 왼쪽 대화: 알림 글 + 오른쪽 링크만(입력 칸 · 고르기 칸 · 확정 단추 없음) ──
  const cards: { key: string; alert?: boolean; node: ReactNode }[] = [];
  cards.push({ key: "home", node: (
    <>
      {tradeStd != null
        ? <><p>집 정보와 표준견적서는 끝났어요. <b>{TRADE_WORD[active]}</b> 표준견적서 <b className="mj-num">{won(tradeStd)}</b>(업체 견적이 아니에요).</p><p className={s.why}>전체 표준견적서 <b className="mj-num">{stdTotal != null ? won(stdTotal) : "—"}</b>은 공종별 금액을 합친 금액이에요(부가세 포함).</p></>
        : <p>집 정보와 표준견적서는 끝났어요. 표준견적서 <b className="mj-num">{stdTotal != null ? won(stdTotal) : "—"}</b>(부가세 포함, 업체 견적이 아니에요).</p>}
      {std ? <button type="button" className={s.boardLink} onClick={() => setStdOpen(true)}>표준견적서 바로 보기</button> : <Link href={`/projects/${pid}/standard`}>표준견적서 보기</Link>}
    </>
  ) });
  // 지금 할 일은 그 공정 것만(다른 공정 할 일은 그 탭에서)
  const myTodo = multi ? ov.trades.find((t) => t.trade === active)?.todo : ov.todo;
  if (myTodo?.text) cards.push({ key: "todo", alert: true, node: <p><b>{myTodo.text}</b></p> });
  // 공사 순서는 목공 → 도배(→ 바닥)예요. 앞 공정이 뒤처져 있으면 뒤 공정 탭에서 먼저 알려요(막지는 않아요)
  const mokStep = multi ? stepOf(data, "mokgong") : 8;
  if (multi && !isMok && mokStep < 6 && now > mokStep) {
    cards.push({ key: "order", alert: true, node: (
      <>
        <p><b>공사 순서는 목공 → 도배예요.</b> 목공이 아직 <b>{PLAN_STEPS[Math.min(mokStep, 7)]}</b> 단계라 도배보다 뒤에 있어요. 목공(몰딩 · 걸레받이 · 문)을 도배 뒤에 하면 새 벽지가 상할 수 있어요.</p>
        <button type="button" className={s.boardLink} onClick={() => pickTrade("mokgong")}>목공 먼저 진행하기</button>
      </>
    ) });
  }
  if (showDobae && !vs.length && !deal && closed.length) {
    cards.push({ key: "closed", alert: true, node: <p>{closed.map((v) => v.vendor_name).join(" · ")} 실측 요청은 닫혔어요(거절 · 기한 지남 등). 다른 업체를 담아 다시 물어봐 주세요.</p> });
  }
  if (showDobae && !vs.length && !deal) {
    cards.push({ key: "vendors", node: (
      <>
        <p>{ready.length ? <>이 조건으로 가견적을 낸 업체가 <b>{ready.length}곳</b> 있어요.</> : "이 지역에 가견적을 낸 업체가 아직 없어요."} <b>가견적</b>은 업체가 확인한 단가로 믿집이 계산한 <b>실측 전 금액</b>이에요.</p>
        {/* 다음에 누를 단추를 말해요(정석 피드백 9) */}
        <p>{picked.length ? `${picked.length}곳을 담았어요. 내 도배 플랜 실측 칸에서 날짜를 골라 바로 요청해요.` : <>내 도배 플랜에서 마음에 드는 곳을 담아 주세요. 업체 줄의 <b>담기</b> 단추를 누르면 돼요.</>}</p>
        {picked.length ? go(3, "실측 날짜 고르기") : go(2)}
      </>
    ) });
  }
  if (multi && isMok && !mokPicked.length && !mvs.length) {
    cards.push({ key: "mok-pick", node: <><p>목공 업체를 담아 주세요. 업체 줄의 <b>담기</b> 단추를 누르면 실측 날짜를 고를 수 있어요.</p>{go(2)}</> });
  }
  if (showMok && mokPicked.length && !mvs.length) {
    cards.push({ key: "mok", node: <><p>목공 <b>{mokPicked.length}곳</b>을 담았어요. 실측 칸에서 목공 날짜도 골라 바로 요청해요.</p>{go(3, "목공 실측 날짜 고르기")}</> });
  }
  for (const v of both) {
    if (v.status === "requested") cards.push({ key: v.id, node: <p><b>{v.vendor_name}</b>에 실측 날짜를 물어봤어요. 업체가 되는 기간을 보내면 먼저 알려 드릴게요. 궁금한 건 <button type="button" className={s.inlineLink} onClick={() => setWin({ kind: "chat", vendorName: v.vendor_name })}>업체 채팅</button>으로 물어보세요.</p> });
    else if (v.status === "offered" || v.status === "proposed") cards.push({ key: v.id, alert: true, node: <><p><b>{iga(v.vendor_name)} {v.status === "proposed" ? "다른 실측 날을 제안했어요." : "실측 되는 날을 보냈어요."}</b> 내 {TRADE_WORD[v.trade as Trade] ?? "도배"} 플랜에서 집에 계실 반나절을 골라 주세요.</p>{go(3)}</> });
    else if (v.status === "picked") cards.push({ key: v.id, node: <><p><b>{v.vendor_name}</b>에 고른 날을 보냈어요. 업체가 현장 정보를 보고 수락하면 실측이 확정돼요.</p><p className={s.why}>주차 · 엘리베이터 사정으로 업체가 다른 날을 제안하면 먼저 알려 드릴게요. 그 사이 <button type="button" className={s.inlineLink} onClick={() => setWin({ kind: "chat", vendorName: v.vendor_name })}>업체 채팅</button>으로 주고받을 수 있어요.</p></> });
    else if (v.status === "booked") cards.push({ key: v.id, node: <>{v.trade === "mokgong"
      ? <><p><b>{v.vendor_name}</b> 실측이 잡혔어요. 실측 때 업체가 몰딩 · 걸레받이 · 문 치수와 상태를 재고 견적서를 보내요.</p><p className={s.why}>실측 전날: 문과 벽 아래가 보이게 짐을 떼어 두고, 철거 · 폐기물이 견적에 들어가는지 물어보세요.</p></>
      : <><p><b>{v.vendor_name}</b> 실측이 잡혔어요. 실측 때 업체가 벽 크기와 상태를 재고 견적서를 보내요.</p><p className={s.why}>실측 전날: 가구 앞 벽이 보이게 비워 두고, 벽지 철거 · 폐기물이 견적에 들어가는지 물어보세요.</p></>}</> });
    else if (v.status === "visited") cards.push({ key: v.id, node: <p><b>{v.vendor_name}</b> 실측을 마쳤어요. 실측 견적서를 기다리고 있어요.</p> });
  }
  if (waiting) {
    cards.push({ key: "wait", node: (
      <>
        <div className={s.wait} role="status"><span className={s.waitBar} aria-hidden="true" /><span>업체 답을 기다리는 중이에요</span></div>
        <p>기다리는 동안 미리 해 두면 좋은 것들이에요. 다른 업체도 둘러보고 더 담으면 실측을 같이 물어볼 수 있어요(공정마다 3곳까지).</p>
        <div className={s.row}>
          <button type="button" className={s.boardLink} onClick={() => toBoard(2)}>다른 업체 둘러보기</button>
          <button type="button" className={s.boardLink} onClick={() => setWin({ kind: "term", name: multi && isMok ? "천장 몰딩" : "실크 벽지" })}>{multi && isMok ? "몰딩 알아보기" : "벽지 자재 알아보기"}</button>
          <button type="button" className={s.boardLink} onClick={() => setWin({ kind: "plan" })}>공사 순서 다시 보기</button>
          {std ? <button type="button" className={s.boardLink} onClick={() => setStdOpen(true)}>표준견적서 다시 보기</button> : null}
        </div>
      </>
    ) });
  }
  if (showDobae && quoted.length && !deal) {
    cards.push({ key: "compare", alert: true, node: <><p><b>실측 견적서가 {quoted.length}곳에서 도착했어요.</b> 표준견적서와 먼저 비교해 뒀어요. 내 도배 플랜에서 보고 확정해요.</p>{go(4)}</> });
  }
  if (showDobae && deal) {
    const d = deal.deal;
    cards.push({ key: "deal", node: <p><b>{euro(d.vendor_name)}</b> 확정했어요. 확정 금액 <b className="mj-num">{won(d.quote.total)}</b>.</p> });
    if (deal.dates_state === "waiting") cards.push({ key: "dates-wait", node: <p>{iga(d.vendor_name)} 공사 날짜를 올리면 알려 드릴게요.</p> });
    if ((deal.dates_state === "proposed" || deal.dates_state === "change_proposed") && deal.proposal) {
      const x = deal.proposal;
      cards.push({ key: "dates", alert: true, node: <><p><b>{iga(d.vendor_name)} 공사 날짜를 올렸어요.</b> {dateShort(x.start)} ~ {dateShort(x.end)} · {x.workdays}일 · {x.crew}명. 내 도배 플랜에서 수락하거나 다른 날짜를 요청해요.</p>{go(5)}</> });
    }
    if (deal.dates_state === "scheduled" && d.status === "scheduled") {
      const before = d.start_date && d.start_date > today;
      cards.push({ key: "work", node: before
        ? <><p>공사는 <b>{d.start_date ? dateShort(d.start_date) : ""}</b>에 시작해요. 공사 전에 할 일은 내 도배 플랜에서 체크해요. 체크한 건 업체도 봐요.</p>{go(5)}</>
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
    for (const x of extras) cards.push({ key: `x${x.id}`, alert: true, node: <><p><b>{iga(d.vendor_name)} 추가 금액을 요청했어요.</b> {x.title} · <b className="mj-num">{won(x.total)}</b>. 내 도배 플랜에서 승인하거나 거절해요.</p>{go(6)}</> });
    if (d.status === "checking") cards.push({ key: "check", alert: true, node: <><p><b>{iga(d.vendor_name)} 공사를 마쳤다고 올렸어요.</b> 내 도배 플랜의 목록으로 같이 확인하고 완료를 눌러요.</p>{go(7)}</> });
    if (d.status === "done") cards.push({ key: "review", node: d.review_open ? <><p><b>공사를 완료했어요.</b> 수고 많으셨어요. {d.vendor_name} 리뷰를 남기면 다음 고객이 업체를 고를 때 도움이 돼요.</p><button type="button" className={s.boardLink} onClick={() => setWin({ kind: "review" })}>리뷰 남기기</button></> : <p>리뷰까지 마쳤어요. 하자가 보이면 {d.vendor_name}에 채팅으로 알려 주세요. 수고 많으셨어요.</p> });
  }

  // 공정마다 확정 견적이 모두 나오면 합친 최종 금액(서버 overview.money 값 그대로)
  if (multi && ov.money.all_confirmed) {
    cards.push({ key: "final", node: <p><b>최종 견적 합계 <span className="mj-num">{won(ov.money.total)}</span></b> · {ov.money.by_trade.map((m) => `${TRADE_WORD[m.trade as Trade] ?? m.trade} ${won(m.total)}`).join(" + ")}. 공종별 확정 견적서를 합친 금액이에요.</p> });
  }

  // ── 오른쪽 보드: 단계별 고르기 · 단추 ──
  function board(step: number): ReactNode {
    // 목공 탭: 견적서 비교부터는 아직 도배만 이 화면에서 해요(#206)
    if (multi && isMok && step >= 4) return <p className={s.note}>목공 견적서 비교 · 확정 · 공사 일정은 이 화면에서 아직 준비 중이에요. 실측 칸까지 여기서 하고, 그 뒤는 업체 채팅과 내 공사 화면에서 이어 가요.</p>;
    if (step === 0) return (
      <>
        <Button size="sm" variant="secondary" onClick={() => setWin({ kind: "edit" })}>{p.locked ? "기본 정보 보기(요청 뒤라 잠겼어요)" : "기본 정보 고치기"}</Button>
        <SiteInfoCard projectId={p.id} />
      </>
    );
    if (step === 1) return (
      <>
        {std ? <Button size="sm" onClick={() => setStdOpen(true)}>{tradeStd != null ? `${TRADE_WORD[active]} 표준견적서 보기 · ${won(tradeStd)}` : `표준견적서 보기 · ${won(stdTotal ?? std.view.total)}`}</Button> : <Link href={`/projects/${pid}/standard`}>표준견적서 보기 · {stdTotal != null ? won(stdTotal) : "—"}</Link>}
        <Button size="sm" variant="secondary" onClick={() => setWin({ kind: "plan" })}>예상 공정표 보기</Button>
      </>
    );
    if (step === 2) return (
      <>
        {mokVendors && !multi ? (
          <div className={s.trades} role="tablist" aria-label="공정별 업체">
            {(["dobae", "mokgong"] as Trade[]).map((t) => {
              const n = listOf(t).filter((v) => v.shortlisted).length;
              return <button key={t} type="button" role="tab" aria-selected={trade === t} className={trade === t ? `${s.tradeTab} ${s.tradeOn}` : s.tradeTab} onClick={() => setTrade(t)}>{TRADE_WORD[t]} <span className="mj-num">{n}/{MAX_PICK}</span></button>;
            })}
          </div>
        ) : null}
        {/* 실측을 기다리는 동안에도 다른 업체를 보고 더 담아요(공정마다 3곳까지). 확정한 뒤에만 닫아요 */}
        {!(trade === "dobae" && deal) ? (
          <>
            <div className={s.search} role="search">
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="업체 이름 · 지역으로 찾기" aria-label={`${TRADE_WORD[trade]} 업체 찾기`} />
            </div>
            {/* 표준견적서 합계에는 목공도 들어 있어서, 가견적 % 기준(도배만 시장 단가 · 서버 값)을 따로 보여요 */}
            {trade === "dobae" && mokVendors && vendors ? <p className={s.note}>가견적 %는 도배만 시장 단가 <b className="mj-num">{won(vendors.standard_total)}</b>와 견줘요. 표준견적서 합계에는 목공도 들어 있어요.</p> : null}
            <VendorRows list={listOf(trade).filter((v) => v.state === "ok")} query={query} hi={hi} trade={trade} pick={pickOf(trade)} pid={pid} busy={busy} act={act} onOpen={(vendorId) => setVOpen({ vendorId, trade })} />
          </>
        ) : <p className={s.note}>도배 업체를 확정했어요. 일정 칸을 봐 주세요.</p>}
        {trade === "dobae" && draft?.vendors.length && !deal ? (
          <Button size="lg" block onClick={() => setTab(3)}>{vs.length ? `도배 남은 ${draft.vendors.length}곳도 실측 날짜 고르기 →` : `도배 담은 ${draft.vendors.length}곳 실측 날짜 고르기 →`}</Button>
        ) : null}
        {trade === "mokgong" && mokDraft?.vendors.length ? (
          <Button size="lg" block onClick={() => setTab(3)}>{mvs.length ? `목공 남은 ${mokDraft.vendors.length}곳도 실측 날짜 고르기 →` : `목공 담은 ${mokDraft.vendors.length}곳 실측 날짜 고르기 →`}</Button>
        ) : null}
      </>
    );
    if (step === 3) return (
      <>
        {/* 아직 요청하지 않은 담은 업체(draft)에는 실측 요청 뒤에도 보낼 수 있어요 */}
        {showDobae && !deal && draft?.vendors.length ? (
          <>
            {vs.length ? <p className={s.note}>아직 요청하지 않은 도배 업체 {draft.vendors.length}곳에도 보낼 수 있어요.</p> : null}
            <BoardVisitRequest pid={pid} trade="dobae" draft={draft} today={today} busy={busy} act={act} />
          </>
        ) : null}
        {showDobae && !vs.length && !deal && !draft?.vendors.length ? <p className={s.note}>먼저 업체 칸에서 도배 업체를 담아 주세요. <button type="button" className={s.boardLink} onClick={() => { setTrade("dobae"); setTab(2); }}>업체 칸으로</button></p> : null}
        {showMok && mokVendors && mokDraft?.vendors.length ? (
          <>
            {mvs.length ? <p className={s.note}>아직 요청하지 않은 목공 업체 {mokDraft.vendors.length}곳에도 보낼 수 있어요.</p> : null}
            <BoardVisitRequest pid={pid} trade="mokgong" draft={mokDraft} today={today} busy={busy} act={act} />
          </>
        ) : null}
        {showMok && mokVendors && !mvs.length && !mokDraft?.vendors.length ? <p className={s.note}>목공 업체를 담으면 여기서 목공 실측 날짜도 골라요. <button type="button" className={s.boardLink} onClick={() => { setTrade("mokgong"); setTab(2); }}>목공 업체 칸으로</button></p> : null}
        {toPick.map((v) => (
          <div key={v.id} data-hi={v.vendor_id && hi.includes(v.vendor_id) ? "1" : undefined}>
            {v.vendor_id && hi.includes(v.vendor_id) ? <span className={s.hiTag}>재재가 말한 업체</span> : null}
            <PickCard pid={pid} visitId={v.id} name={v.vendor_name} proposal={v.status === "proposed"} busy={busy} act={act} />
          </div>
        ))}
        {/* 업체마다 카드 하나: 상태 · 큰 채팅 단추 · 취소(정석 피드백 10: 채팅 단추가 작아 찾기 어려움) */}
        {both.map((v) => {
          const on = !!v.vendor_id && hi.includes(v.vendor_id);
          return (
          <div key={`c${v.id}`} data-hi={on ? "1" : undefined} className={on ? `${s.card} ${s.vrowHi}` : s.card}>
            <h4>{mokVendors ? `${TRADE_WORD[v.trade as Trade] ?? ""} ` : ""}{v.vendor_name}{on ? <span className={s.hiTag}>재재가 말한 업체</span> : null}</h4>
            {!toPick.includes(v) ? <p className={s.note}>{VISIT_WORD[v.status] ?? "진행 중"}</p> : null}
            <Button size="lg" block icon="chat" onClick={() => setWin({ kind: "chat", vendorName: v.vendor_name })}>{gwaWa(v.vendor_name)} 채팅하기</Button>
            {/* 답 전 요청은 '요청 취소', 잡힌 실측은 '실측 취소'(UC-VND-06). 실측을 다녀간 뒤에는 취소하지 않아요 */}
            {["requested", "offered", "picked", "proposed", "booked"].includes(v.status) ? (
              <button type="button" className={s.boardLink} onClick={() => setCancel({ id: v.id, name: v.vendor_name, request: v.status !== "booked" })}>{v.status === "booked" ? "실측 취소" : "요청 취소"}</button>
            ) : null}
          </div>
          );
        })}
      </>
    );
    if (step === 4) return (
      <>
        {quoted.length && !deal ? (
          <>
            {quoted.map((r) => {
              const on = !!r.vendor_id && hi.includes(r.vendor_id);
              return (
              <div key={r.visit_id} data-hi={on ? "1" : undefined} className={on ? `${s.card} ${s.vrowHi}` : s.card}>
                <h4>{r.vendor_name}{on ? <span className={s.hiTag}>재재가 말한 업체</span> : null}</h4>
                <b className="mj-num">{r.latest!.total != null ? won(r.latest!.total) : "—"}</b>
                <span className={s.note}>실측 견적서 · 확정 전 금액{r.vs_direction !== "same" && vsPct(r.vs_standard, r.vs_direction) ? ` · 표준견적서보다 ${vsPct(r.vs_standard, r.vs_direction)}` : ""}</span>
                {r.estimate_total != null ? <span className={s.note}>가견적(실측 전) {won(r.estimate_total)}</span> : null}
                <Button size="sm" busy={busy === `c${r.visit_id}`} disabled={r.seen_ver == null}
                  onClick={() => act(`c${r.visit_id}`, () => call("POST", `/projects/${pid}/quotes/${enc(r.visit_id)}/confirm`, { seen_ver: r.seen_ver }), `${euro(r.vendor_name)} 확정했어요`)}>{euro(r.vendor_name)} 확정</Button>
              </div>
              );
            })}
            <p className={s.why}>확정은 직접 눌러요. 확정하면 다른 업체 견적서는 닫혀요.</p>
          </>
        ) : null}
        {!quoted.length && !deal ? <p className={s.note}>실측 뒤 업체가 견적서를 보내면 여기서 표준견적서와 견줘 확정해요.</p> : null}
        {/* 확정 전 다시 고르기(UC-QUO-03): 이 공정 실측 요청을 모두 닫고 업체 칸에서 다시 골라요 */}
        {vs.length && !deal ? <Reselect projectId={p.id} trade="dobae" title="업체를 다시 고를까요?" body="지금 요청한 실측과 받은 견적서가 모두 닫혀요. 업체 칸에서 다시 골라요." /> : null}
      </>
    );
    if (step === 5) {
      const x = deal && (deal.dates_state === "proposed" || deal.dates_state === "change_proposed") ? deal.proposal : null;
      return (
        <>
          {deal && x ? (
            <div className={s.card}>
              <h4>{iga(deal.deal.vendor_name)} 올린 공사 날짜</h4>
              <p>{dateShort(x.start)} ~ {dateShort(x.end)} · {x.workdays}일 · {x.crew}명</p>
              <div className={s.row}>
                <Button size="sm" busy={busy === "accept"} onClick={() => act("accept", () => call("POST", `/projects/${pid}/deals/${enc(deal.deal.id)}/dates/${enc(x.id)}/accept`, { seen_version: schedule!.final_version }), "공사 날짜를 수락했어요")}>이 날짜로 수락</Button>
                <Button size="sm" variant="secondary" onClick={() => setWin({ kind: "schedule", view: "dates" })}>다른 날짜 요청</Button>
              </div>
            </div>
          ) : null}
          {deal ? <Button size="sm" variant="secondary" onClick={() => setWin({ kind: "schedule", view: "dates" })}>공사 날짜 보기 · 바꾸기</Button> : null}
          {ov.checks.length ? <PreWorkCheck projectId={p.id} checks={ov.checks} start={deal?.deal.start_date ?? null} /> : null}
          <Button size="sm" variant="secondary" onClick={() => setWin({ kind: "plan" })}>공정표 보기</Button>
          {/* 공사 날짜를 수락하기 전이면 확정을 풀고 다시 고를 수 있어요(UC-QUO-03) */}
          {deal && (deal.dates_state === "waiting" || deal.dates_state === "proposed") ? (
            <Reselect projectId={p.id} trade="dobae" dealId={deal.deal.id} title={`${deal.deal.vendor_name} 대신 다른 업체를 고를까요?`} body="확정을 풀고 실측부터 다시 요청해요. 받은 공사 날짜는 닫혀요." />
          ) : null}
        </>
      );
    }
    if (step === 6) return (
      <>
        {deal ? extras.map((x) => (
          <div key={x.id} className={s.card}>
            <h4>추가 금액 · {x.title}</h4>
            <b className="mj-num">{won(x.total)}</b>
            <p className={s.why}>이유: {x.reason.replace(/[.。]\s*$/, "")}. 승인해야 금액에 더해져요.</p>
            <div className={s.row}>
              <Button size="sm" busy={busy === `xa${x.id}`} onClick={() => act(`xa${x.id}`, () => call("POST", `/projects/${pid}/deals/${enc(deal.deal.id)}/extras/${enc(x.id)}/answer`, { answer: "approve" }), `추가 금액(${x.title})을 승인했어요`)}>승인</Button>
              <Button size="sm" variant="secondary" busy={busy === `xr${x.id}`} onClick={() => act(`xr${x.id}`, () => call("POST", `/projects/${pid}/deals/${enc(deal.deal.id)}/extras/${enc(x.id)}/answer`, { answer: "reject" }), `추가 금액(${x.title})을 거절했어요`)}>거절</Button>
              {x.answer === "asked" ? <span className={s.note}>채팅으로 물어봤어요</span> : <Button size="sm" variant="weak" busy={busy === `xq${x.id}`} onClick={() => act(`xq${x.id}`, () => call("POST", `/projects/${pid}/deals/${enc(deal.deal.id)}/extras/${enc(x.id)}/answer`, { answer: "ask" }), "추가 금액을 채팅으로 물어봤어요")}>물어볼래요</Button>}
            </div>
          </div>
        )) : null}
        {deal ? <Button size="sm" variant="secondary" onClick={() => setWin({ kind: "schedule", view: "extra" })}>추가 금액 · 공사 일정 보기</Button> : null}
      </>
    );
    return (
      <>
        {deal?.deal.status === "checking" ? (
          <div className={s.card}>
            <h4>완료 전에 같이 확인해요</h4>
            <ul className={s.auto}><li>벽지가 들뜨거나 운 곳이 없는지</li><li>이음매가 벌어지지 않았는지</li><li>모서리 · 콘센트 둘레가 깔끔한지</li><li>몰딩 · 걸레받이와 벽지 사이가 뜨지 않았는지</li></ul>
            <div className={s.row}>
              <Button size="sm" busy={busy === "done"} onClick={() => act("done", () => call("POST", `/projects/${pid}/deals/${enc(deal.deal.id)}/check`, { result: "done" }), "공사 완료를 확인했어요")}>확인했어요, 완료</Button>
              <Button size="sm" variant="secondary" onClick={() => setWin({ kind: "schedule", view: "done" })}>고칠 곳이 있어요</Button>
            </div>
          </div>
        ) : null}
        {deal?.deal.status === "done" && deal.deal.review_open ? <Button size="sm" onClick={() => setWin({ kind: "review" })}>리뷰 남기기</Button> : null}
        {deal ? <Button size="sm" variant="secondary" onClick={() => setWin({ kind: "schedule", view: "done" })}>공사 끝 확인 보기</Button> : null}
      </>
    );
  }

  const auto: Record<number, string[]> = { 0: ["집 정보 정리"], 1: ["표준견적서 계산"], 2: vs.length ? ["업체에 실측 날짜 물어보기"] : [], 4: quoted.length ? ["견적서를 표준견적서와 비교"] : [], 5: deal ? ["확정 공정표 만들기"] : [] };
  const terms = (multi && isMok ? ["천장 몰딩", "걸레받이", "가견적", "실측 견적서", "하자담보책임기간"] : ["실크 벽지", "가견적", "실측 견적서", "보양", "하자담보책임기간"]).map((n) => termByName(n)).filter((t) => t !== undefined);
  // 입력칸 위 질문 버튼(#180): 마지막 답의 추천 질문, 없으면 지금 칸의 시작 질문. 물은 건 빼요
  const lastOut = [...asks].reverse().find((a) => a.out)?.out ?? null;
  const quick = quickChips(now, asks.filter((a) => !a.err).map((a) => a.q), lastOut?.answer.suggest ?? null, active); // 오류로 끝난 질문은 다시 누를 수 있게 남겨요

  return (
    <div className={s.page}>
      <button type="button" className={s.planBar} aria-expanded={open} aria-controls="jj-board" onClick={() => setOpen((v) => !v)}><b>{Math.min(now + 1, 8)}/8 · 내 {TRADE_WORD[active]} 플랜</b><span>{open ? "접기" : "보기"}</span></button>
      {/* 폰 · 태블릿: 위 띠가 숨겨져서 공정 탭을 여기 둬요(웹은 위 띠의 탭) */}
      {multi ? (
        <div className={s.flowTabs} role="tablist" aria-label="공정">
          {tradeKeys.map((t) => (
            <button key={t} type="button" role="tab" aria-selected={active === t} className={active === t ? `${s.flowTab} ${s.flowTabOn}` : s.flowTab} onClick={() => pickTrade(t)}>
              {TRADE_WORD[t]} <span className="mj-num">{Math.min(stepOf(data, t) + 1, 8)}/8</span>
            </button>
          ))}
        </div>
      ) : null}
      <div className={s.body}>
        <section className={s.chat} aria-label={multi ? `재재와 대화 · ${TRADE_WORD[active]}` : "재재와 대화"}>
          <AiActionContext.Provider value={onAiAction}>
          <div className={s.msgs} role="log" aria-live="polite">
            {cards.map((c) => (
              <div key={c.key} className={`${s.bot} ${c.alert ? s.alert : ""}`}>
                <div className={s.face}><Jaejae mouth={c.alert ? "open" : "smile"} /></div>
                <div className={s.bubble}><span className={s.who}>{c.alert ? "재재 · 먼저 알려 드려요" : "재재 · 믿집 비서"}</span>{c.node}</div>
              </div>
            ))}
            {done.map((t, i) => <p key={`d${i}`} className={s.done} role="status">✓ {t}</p>)}
            {err ? <p className="mj-error" role="alert">{err}</p> : null}
            {asks.map((a, i) => (
              <div key={`a${i}`} className={s.msgs} style={{ padding: 0 }}>
                <p className={s.me}>{a.q}</p>
                <div className={s.bot}><div className={s.face}><Jaejae mouth={a.out ? "smile" : "flat"} /></div><div className={s.bubble}><span className={s.who}>재재</span>
                  {a.out ? <><AiAnswer answer={a.out.answer} projectId={p.id} onPick={(q, b) => void ask(q, b ?? null)} />{a.to != null ? go(a.to) : null}</> : a.err ? <p className="mj-error">{a.err}</p> : <p className={s.typing}>줄자로 재는 중…</p>}</div></div>
              </div>
            ))}
          </div>
          </AiActionContext.Provider>
          <div className={s.dock}>
            {quick.length ? (
              <div className={s.quick} role="group" aria-label="이런 걸 물어보세요">
                {quick.map((q) => <button key={q} type="button" className={s.chip} disabled={asking} onClick={() => void ask(q)}>{q}</button>)}
              </div>
            ) : null}
            <form className={s.input} onSubmit={(e) => { e.preventDefault(); void ask(text, null, true); }}>
              <label className="mj-sr" htmlFor="pflow-in">재재에게 물을 말</label>
              <textarea id="pflow-in" rows={1} maxLength={1000} value={text} placeholder="궁금한 걸 물어보세요. 예: 가견적이 비싼데 줄일 방법 없을까요?" onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void ask(text, null, true); } }} />
              <Button type="submit" disabled={!text.trim() || asking}>{asking ? "답 기다리는 중" : "보내기"}</Button>
            </form>
          </div>
          {/* 새 말이 오면 여기까지 내려요. 입력칸(dock) 뒤에 두어 마지막 말풍선이 입력칸에 가려지지 않아요 */}
          <div ref={end} />
        </section>
        <Plan title={`내 ${TRADE_WORD[active]} 플랜`} todo={multi && isMok ? MOK_TODO : undefined} now={now} scope={multi && isMok ? `${p.id}_mokgong` : p.id} open={open} auto={auto} tab={tab} onTab={setTab} render={board}
          extra={<div className={s.row}><button type="button" className={s.textBtn} onClick={() => setWin({ kind: "log" })}>결정 기록</button><button type="button" className={s.textBtn} onClick={() => setWin({ kind: "docs" })}>서류</button></div>} />
      </div>
      <div className={s.chips} aria-label="믿집 백과">
        {terms.map((t) => <button key={t.id} type="button" className={s.chip} onClick={() => setWin({ kind: "term", name: t.term })}>백과<b>{t.term}</b></button>)}
      </div>
      {cancel ? (
        <CancelSheet open onClose={() => setCancel(null)} projectId={p.id} visitId={cancel.id} vendorName={cancel.name} request={cancel.request}
          onDone={() => { setDone((x) => [...x, `${cancel.name} ${cancel.request ? "요청" : "실측"}을 취소했어요`]); setCancel(null); startRefresh(() => router.refresh()); }} />
      ) : null}
      <VendorDialog pid={pid} open={vOpen} onClose={() => setVOpen(null)} busy={busy} act={act}
        pick={pickOf(vOpen?.trade ?? "dobae")} />
      {std ? <StandardDialog open={stdOpen} onClose={() => setStdOpen(false)} onPick={() => { setStdOpen(false); toBoard(2); }} data={std} pid={pid} locked={p.locked} basis={vendors?.standard_total ?? null} trade={multi ? active : undefined}
        onEdit={() => { setStdOpen(false); setWin({ kind: "edit" }); }} onPlan={() => { setStdOpen(false); setWin({ kind: "plan" }); }} /> : null}
      <Windows win={win} onClose={() => setWin(null)} data={{ ...data.win, pid, projectId: p.id, today, locked: p.locked, schedule, startDate: deal?.deal.start_date ?? null }}
        onDone={(said) => { setWin(null); setDone((x) => [...x, said]); startRefresh(() => router.refresh()); }} />
    </div>
  );
}

type Act = (key: string, fn: () => Promise<unknown>, said?: string) => Promise<void>;
const VISIT_WORD: Record<string, string> = { requested: "날짜 묻는 중", picked: "고른 날 보냄 · 업체 수락 기다림", booked: "실측 잡힘", visited: "실측 끝 · 견적서 기다림", quoted: "견적서 옴" };

type Card = ProjectVendors["local"][number];
/** 보드 업체 줄(#197): 찾기 낱말로 거르고, AI 답에 나온 업체는 위로 올려 강조해요. 공정마다 3곳까지 담아요 */
function VendorRows({ list, query, hi, trade, pick, pid, busy, act, onOpen }: { list: Card[]; query: string; hi: string[]; trade: Trade; pick: PickState; pid: string; busy: string | null; act: Act; onOpen: (vendorId: string) => void }) {
  const key = norm(query);
  const shown = list
    .filter((v) => !key || norm(`${v.name} ${v.sgg}`).includes(key))
    .sort((a, b) => Number(hi.includes(b.vendor_id)) - Number(hi.includes(a.vendor_id)));
  const full = !pick.locked && pick.left <= 0;
  // 아직 하나도 안 담았으면 '담기' 단추를 테두리로 짚어 줘요(정석 피드백 9)
  const none = !list.some((v) => v.shortlisted);
  const first = useRef<HTMLDivElement>(null);
  const [all, setAll] = useState(false);
  // 강조가 바뀌면 그 업체가 보이게 옮겨요
  useEffect(() => { if (hi.length) first.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [hi]);
  if (!list.length) return <p className={s.note}>이 지역에 {TRADE_WORD[trade]} 가견적을 낸 업체가 아직 없어요.</p>;
  if (!shown.length) return <p className={s.note} role="status">찾는 업체가 없어요. 업체 이름이나 구 이름으로 찾아 주세요.</p>;
  return (
    <div className={s.vlist}>
      {shown.slice(0, all ? shown.length : 8).map((v, i) => {
        const on = hi.includes(v.vendor_id);
        const can = pickRule(v, pick);
        return (
          <div key={v.vendor_id} ref={on && i === 0 ? first : undefined} className={[s.vrow, v.shortlisted ? s.vrowOn : "", on ? s.vrowHi : ""].join(" ")}>
            <div className={s.vcol}><button type="button" className={s.vname} onClick={() => onOpen(v.vendor_id)} aria-label={`${v.name} 자세히`}>{v.name} ›</button>{on ? <span className={s.hiTag}>재재가 말한 업체</span> : null}<span className={s.note}>{v.rating ? `별 ${v.rating} · ` : ""}후기 {v.review_count} · 시공 {v.done_count}</span></div>
            <div className={s.row}>
              <b className="mj-num">{v.estimate_total != null ? won(v.estimate_total) : "—"}</b>
              {pick.live.has(v.vendor_id) ? <span className={s.note}>실측 요청한 업체</span> : (
              <Button size="sm" variant={v.shortlisted ? "secondary" : "weak"} className={none && can.add ? s.pickHint : undefined} busy={busy === v.vendor_id} disabled={!(can.add || can.remove)}
                onClick={() => (can.add || can.remove) && act(v.vendor_id, () => v.shortlisted ? call("DELETE", `/projects/${pid}/shortlist/${enc(v.vendor_id)}?trade=${trade}`) : call("POST", `/projects/${pid}/shortlist`, { trade, vendor_id: v.vendor_id }), `${TRADE_WORD[trade]} ${v.name}${v.shortlisted ? " 뺐어요" : " 담았어요"}`)}>
                {v.shortlisted ? "빼기" : "담기"}
              </Button>
              )}
            </div>
          </div>
        );
      })}
      {pick.locked ? <p className={s.note}>{TRADE_WORD[trade]} 업체를 확정해서 더 담거나 뺄 수 없어요. 업체 정보는 볼 수 있어요.</p> : null}
      {shown.length > 8 ? <button type="button" className={s.boardLink} onClick={() => setAll((x) => !x)}>{all ? "접기" : `업체 ${shown.length - 8}곳 더 보기`}</button> : null}
      {full ? <p className={s.note}>{TRADE_WORD[trade]}는 {MAX_PICK}곳을 다 담았어요. 바꾸려면 하나를 빼 주세요.</p> : null}
    </div>
  );
}

function PickCard({ pid, visitId, name, proposal, busy, act }: { pid: string; visitId: string; name: string; proposal: boolean; busy: string | null; act: Act }) {
  const [pick, setPick] = useState<Pick | null>(null);
  const [failed, setFailed] = useState(false);
  const [sel, setSel] = useState<{ day: string; half: Half } | null>(null);
  useEffect(() => { void call<Pick>("GET", `/projects/${pid}/visits/${enc(visitId)}`).then(setPick).catch(() => setFailed(true)); }, [pid, visitId]);
  // 업체가 보낸 날을 달력으로(팀 피드백 3)
  // 업체가 다른 날을 제안했으면(proposed) 제안한 반나절만 골라요. 영업일 전체를 보이면 제안 밖 날을 눌러 409가 나요(PickBoard와 같은 규칙)
  const offer = proposal && pick?.proposal ? pick.proposal.slots : null;
  const days = offer
    ? [...new Set(offer.map((x) => x.day))].sort().map((day) => ({ day, halves: (["am", "pm"] as Half[]).filter((h) => offer.some((x) => x.day === day && x.half === h)) }))
    : (pick?.days ?? []).map((d) => ({ day: d.day, halves: (["am", "pm"] as Half[]).filter((h) => d[h]) })).filter((d) => d.halves.length);
  return (
    <div className={s.card}>
      <h4>{name} · {offer ? "업체가 제안한 반나절 고르기" : "실측 반나절 고르기"}</h4>
      {offer && pick?.proposal?.note ? <p className={s.why}>업체 말: {pick.proposal.note}</p> : null}
      <div className={s.vlist}>
        {days.length ? <HalfCalendar days={days} value={sel} onChange={setSel} label={`${name} 실측 고를 수 있는 날`} /> : null}
        {failed ? <p className={s.note}>고를 수 있는 날을 불러오지 못했어요. 새로고침하거나 업체 채팅으로 물어봐 주세요.</p> : null}
        {pick && !days.length ? <p className={s.note}>고를 수 있는 반나절이 없어요. 업체 채팅으로 다른 날을 물어봐 주세요.</p> : null}
      </div>
      <Button size="sm" disabled={!sel} busy={busy === `p${visitId}`} onClick={() => sel && act(`p${visitId}`, () => call("POST", `/projects/${pid}/visits/${enc(visitId)}/${proposal ? "proposal/pick" : "pick"}`, sel), `${name}에 ${dateShort(sel.day)} ${HALF[sel.half]}을 보냈어요`)}>
        {sel ? `${dateShort(sel.day)} ${euro(HALF[sel.half])} 보내기` : "반나절을 골라 주세요"}
      </Button>
    </div>
  );
}
