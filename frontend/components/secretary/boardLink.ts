// 재재 대화 → 오른쪽 보드 연동(#197): AI 답과 물은 말을 보고 보드 어느 칸을 보여 줄지, 어떤 업체를 강조할지 골라요.
// 화면에서만 써요(API · AI 카드 모양은 그대로). 금액 · 날짜를 만들지 않아요.
// 1) 물은 말(먼저) · 답 글 · 표 · 초안에 이 공사 업체 이름이 나오면 그 업체를 강조하고, 물은 공종 · 업체 상태에 맞는 칸으로
//    (무료 모드 답은 업체 이름을 거의 안 꺼내서 물은 말도 봐요)
// 2) 이름이 없으면 낱말로: 일정 말(실측 날짜 · 반나절 · 공사 날짜 · 공정표 · 일정)이면 일정 칸, 업체 말이면 업체 칸
// 3) 둘 다 없으면 그대로

export type BoardAnswer = {
  lead?: string; notice: string; vendor?: string[];
  sections: { title: string; sentences: string[]; caution: string; tip: string }[];
  cards: { title: string; text: string; draft?: { vendors: string[]; recommend?: { vendor: string } | null } | null; table?: { cols: string[]; rows: { cells: string[] }[] } | null }[];
};
/** stage: 도배 실측 견적서를 보냈어요(quoted · 비교 칸) · 실측 요청이 진행 중이에요(visit · 실측 칸) */
export type BoardVendor = { vendor_id: string; name: string; trade: "dobae" | "mokgong"; stage?: "quoted" | "visit" };
/** 그 공정 기준(boardStateFor): quoted 견적서가 왔어요 · deal 업체를 확정했어요 · chosen 실측을 이미 보냈어요 */
export type BoardState = { quoted: boolean; deal: boolean; chosen?: boolean };
export type BoardTarget = { tab: number; hi: string[]; trade: "dobae" | "mokgong" | null } | null;

export const norm = (x: string) => x.replace(/\s+/g, "").toLowerCase();

export function answerText(a: BoardAnswer): string {
  const parts = [a.lead ?? "", a.notice, ...(a.vendor ?? []), ...a.sections.flatMap((x) => [x.title, ...x.sentences, x.caution, x.tip])];
  for (const c of a.cards) parts.push(c.title, c.text, ...(c.draft?.vendors ?? []), c.draft?.recommend?.vendor ?? "", ...(c.table?.cols ?? []), ...(c.table?.rows.flatMap((r) => r.cells) ?? []));
  return parts.join(" ");
}

const SCHEDULE = /실측\s*(날짜|일정|날)|반나절|공사\s*(날짜|일정)|공정표|일정|언제\s*(와|오|해|시작)/;
const VENDOR = /업체|가견적|담기|담아/;

const MOK_WORD = /목공|몰딩|걸레받이|방문|목수/;
const DOBAE_WORD = /도배|벽지|초배|실크|합지/;

/** 업체 이름이 나오면
 *  1) 공종: 물은 말에 적은 공종(도배 · 목공 하나만)이 먼저. 안 적었으면 그 업체가 하는 공종,
 *     둘 다 하는 업체는 도배 실측 · 견적서가 있으면 도배, 도배 업체를 이미 골랐으면 목공, 아니면 도배
 *  2) 칸: 도배는 그 업체 상태대로(견적서 보냄 → 비교 칸, 실측 진행 중 → 실측 칸, 아직 없음 → 업체 칸), 목공은 업체 칸 목공 탭
 *  (비교 칸 · 실측 칸은 도배 견적서 · 실측만 보여요) */
export function boardTarget(question: string, a: BoardAnswer, vendors: BoardVendor[], st: BoardState): BoardTarget {
  const pick = (text: string) => vendors.filter((v) => norm(v.name).length >= 2 && text.includes(norm(v.name)));
  // 물은 말에 나온 업체가 먼저예요(답이 다른 공정 업체를 같이 말해도 물은 업체 칸으로)
  const asked = pick(norm(question));
  const hit = asked.length ? asked : pick(norm(answerText(a)));
  if (hit.length) {
    const ids = (xs: BoardVendor[]) => [...new Set(xs.map((v) => v.vendor_id))];
    const of = (t: "dobae" | "mokgong") => hit.filter((v) => v.trade === t);
    // 공종 낱말은 업체 이름을 뺀 글에서 찾아요('결도배' · '한뼘목공'처럼 이름에 공종이 들어 있어요)
    const rest = vendors.reduce((q, v) => q.split(v.name).join(" ").split(v.name.replace(/\s+/g, "")).join(" "), question);
    const saysDobae = DOBAE_WORD.test(rest);
    const saysMok = MOK_WORD.test(rest);
    const want = saysDobae !== saysMok ? (saysDobae ? "dobae" : "mokgong") : null;
    let trade: "dobae" | "mokgong";
    if (want && of(want).length) trade = want;
    else if (!of("dobae").length) trade = "mokgong";
    else if (!of("mokgong").length) trade = "dobae";
    else trade = of("dobae").some((v) => v.stage) ? "dobae" : st.chosen || st.quoted || st.deal ? "mokgong" : "dobae";
    const xs = of(trade);
    if (trade === "mokgong" || st.deal) return { tab: 2, hi: ids(xs), trade };
    const sent = xs.filter((v) => v.stage === "quoted");
    if (sent.length) return { tab: 4, hi: ids(sent), trade };
    const going = xs.filter((v) => v.stage === "visit");
    if (going.length) return { tab: 3, hi: ids(going), trade };
    return { tab: 2, hi: ids(xs), trade };
  }
  if (SCHEDULE.test(question)) return { tab: st.deal ? 5 : 3, hi: [], trade: null };
  if (VENDOR.test(question)) return { tab: st.quoted && !st.deal ? 4 : 2, hi: [], trade: null };
  return null;
}

/** 담기 · 빼기 단추(#220 리뷰): 업체를 보여 주고 강조하는 것과 따로, 서버가 받는 상태에서만 열어요.
 *  locked: 그 공정 업체를 확정했어요(서버 409 locked) · left: 서버가 준 남은 칸(옛 요청이 쓴 칸까지 세요) ·
 *  live: 실측 요청이 살아 있는 업체(담기 409 already · 빼기 409 locked, 요청 취소부터) */
export type PickState = { locked: boolean; left: number; live: Set<string> };
/** 끝난 실측(이 업체는 다시 담기 · 빼기 가능) */
export const CLOSED_VISITS = ["declined", "expired", "cancelled", "no_show", "closed"];
/** 한 공정의 담기 상태: 그 공정 업체를 확정(공사 일정에 그 공정 계약 · 실측에서 고름)했으면 잠그고, 진행 중 실측 업체는 담기 · 빼기를 막아요 */
export function pickStateOf(trade: string, dealTrades: string[], visits: { trade: string; status: string; vendor_id: string | null }[], left: number): PickState {
  const tv = visits.filter((v) => v.trade === trade && !CLOSED_VISITS.includes(v.status));
  return {
    locked: dealTrades.includes(trade) || tv.some((v) => v.status === "chosen"),
    left,
    live: new Set(tv.flatMap((v) => (v.vendor_id ? [v.vendor_id] : []))),
  };
}
export function pickRule(v: { vendor_id: string; shortlisted: boolean }, st: PickState): { add: boolean; remove: boolean } {
  if (st.locked || st.live.has(v.vendor_id)) return { add: false, remove: false };
  return v.shortlisted ? { add: false, remove: true } : { add: st.left > 0, remove: false };
}

/** 실측 요청 결과 한 줄: 서버가 실제로 만든 요청(created)의 업체만 넣어요. 하나도 못 보냈으면 null(#221 리뷰: 실패한 업체까지 성공 안내에 넣지 않게) */
export function requestSaid(picked: { vendor_id: string; text: string }[], created: { vendor_id: string | null }[]): string | null {
  const ok = new Set(created.map((c) => c.vendor_id));
  const sent = picked.filter((x) => ok.has(x.vendor_id)).map((x) => x.text);
  return sent.length ? `실측을 요청했어요 · ${sent.join(" · ")}` : null;
}

/** 업체 채팅 창이 열 대화: 채팅 ID가 있으면 그 대화, 없으면 이 공사의 그 실측 대화(#222 리뷰: 상호명으로 고르지 않아요). 없으면 null */
export function threadOf<T extends { thread_id: string; project_id: string | null; visit_id: string | null }>(
  heads: T[], projectId: string, want: { visitId: string | null; threadId: string | null },
): T | null {
  if (want.threadId) return heads.find((t) => t.thread_id === want.threadId && (t.project_id == null || t.project_id === projectId)) ?? null;
  if (!want.visitId) return null;
  return heads.find((t) => t.project_id === projectId && t.visit_id === want.visitId) ?? null;
}

/** 공정 탭(#234 리뷰): 공정이 둘 이상이면 재재 답의 업체도 고른 탭 공정 업체만 맞춰 봐요.
 *  보드 업체 칸이 탭과 다른 공정을 보이지 않게 해요(둘 다 하는 업체는 그 탭 공정으로) */
export function tabVendors(vs: BoardVendor[], multi: boolean, active: "dobae" | "mokgong"): BoardVendor[] {
  return multi ? vs.filter((v) => v.trade === active) : vs;
}

/** 기다림 카드(#234 리뷰): 그 공정에 업체 답 · 실측 · 견적서를 기다리는 요청만 있고,
 *  그 공정의 확정 · 온 견적서 · 고를 날이 없을 때. 다른 공정 상태는 넣지 않아요 */
export function isWaiting(visits: { status: string }[], st: { deal: boolean; quoted: number; toPick: number }): boolean {
  if (st.deal || st.quoted || st.toPick) return false;
  return visits.some((v) => ["requested", "picked", "booked", "visited"].includes(v.status));
}

/** 보드 이동을 판단할 공정 상태(#234 리뷰): 목공 탭이면 목공의 확정 · 진행 실측만 봐요(도배 견적서 · 확정을 섞지 않아요).
 *  목공은 비교 · 일정 칸이 아직 없어 보드가 실측 칸(3)까지예요 */
export function boardStateFor(mokTab: boolean, dobae: BoardState, mok: { deal: boolean; chosen: boolean }): BoardState & { maxTab: number } {
  return mokTab ? { quoted: false, deal: mok.deal, chosen: mok.chosen, maxTab: 3 } : { ...dobae, maxTab: 7 };
}
/** 고른 칸을 그 공정 보드에 있는 칸으로 맞춰요 */
export function clampTarget<T extends { tab: number }>(to: T | null, maxTab: number): T | null {
  return to ? { ...to, tab: Math.min(to.tab, maxTab) } : null;
}

/** 주소의 공정(?trade=) 그대로 넘길 꼬리(#234 리뷰: 업체 · 실측 · 견적서 주소에서 재재 화면으로 갈 때 공정이 빠지지 않게).
 *  공정 키 모양(영어 소문자 · 숫자 · _)만 넘겨요. 공정 목록은 여기서 정하지 않고, 그 공사에 없는 공정이면 재재 화면이 기본 탭을 골라요 */
export function tradeQuery(raw: string | string[] | undefined | null, lead: "?" | "&" = "&"): string {
  const t = Array.isArray(raw) ? raw[0] : raw;
  return t && /^[a-z][a-z0-9_]{0,19}$/.test(t) ? `${lead}trade=${t}` : "";
}
/** 사이트 안 주소에 공정을 붙여요(이미 있으면 그대로) */
export function withTrade(href: string, trade: string | null | undefined): string {
  if (!trade || /[?&]trade=/.test(href)) return href;
  return `${href}${tradeQuery(trade, href.includes("?") ? "&" : "?")}`;
}
/** 재재 화면이 한 번만 쓰고 지우는 주소 값(옛 화면 · 다른 화면에서 넘어옴). 읽기(cameFrom)와 지우기(ProjectFlow)가 이 목록 하나를 같이 써요(#237) */
export const CAME_KEYS = ["step", "open", "view", "vendor", "grade", "photo"] as const;
const WINS = ["plan", "schedule", "docs", "review", "log"] as const;
const VIEWS = ["dates", "extra", "done"] as const;
type Q = Record<string, string | string[] | undefined>;
/** 넘어온 주소 값 → 처음에 열 보드 칸 · 창 · 업체 창. 모르는 값은 무시해요 */
export function cameFrom(q: Q): {
  step: number | null;
  openWin: (typeof WINS)[number] | null;
  scheduleView: (typeof VIEWS)[number] | null;
  openVendor: { vendorId: string; trade: "dobae" | "mokgong"; grade: "basic" | "economy" | null; photo: number | null } | null;
  openStd: boolean;
} {
  const one = (k: string) => { const v = q[k]; return Array.isArray(v) ? v[0] : v; };
  const step = one("step"), open = one("open"), view = one("view"), vendor = one("vendor"), grade = one("grade"), photo = one("photo");
  const trade = one("trade") === "mokgong" ? "mokgong" : "dobae";
  return {
    step: step && /^[0-7]$/.test(step) ? Number(step) : null,
    openWin: (WINS as readonly string[]).includes(open ?? "") ? (open as (typeof WINS)[number]) : null,
    scheduleView: (VIEWS as readonly string[]).includes(view ?? "") ? (view as (typeof VIEWS)[number]) : null,
    openVendor: vendor && /^[0-9a-f-]{36}$/i.test(vendor) ? {
      vendorId: vendor,
      trade,
      // 벽지 고르기는 도배만이에요(옛 업체 화면과 같아요)
      grade: trade === "dobae" && (grade === "basic" || grade === "economy") ? grade : null,
      photo: photo && /^[1-9][0-9]?$/.test(photo) ? Number(photo) : null,
    } : null,
    openStd: open === "standard",
  };
}
/** 리뷰 창: 쓸 수 있으면 "form", 이미 썼으면 "done", 아직이면 "wait"(옛 리뷰 화면과 같은 조건, #237 리뷰) */
export function reviewState(deal: { review_open?: boolean | null; review_id?: string | null } | null): "form" | "done" | "wait" {
  if (deal?.review_open) return "form";
  return deal?.review_id ? "done" : "wait";
}
/** 주소의 다른 값은 그대로 두고 준 값만 바꿔요(null이면 지워요). 공정 탭을 바꿔도 화면 상태(?tab · ?view · ?sort)가 남게(#234 리뷰) */
export function withQuery(path: string, search: string, set: Record<string, string | null>): string {
  const q = new URLSearchParams(search);
  for (const [k, v] of Object.entries(set)) {
    if (v == null) q.delete(k);
    else q.set(k, v);
  }
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}

/** 표준견적서 금액의 출처를 한 곳에서 정해요(#234 리뷰: 공정별 금액 · 전체 금액 · 창이 같은 기준).
 *  - 공정이 둘 이상(view.parts가 있음): 모든 공정의 공정별 시장 단가가 왔을 때만 시장 단가("parts"), 하나라도 없으면 공공 기준("public").
 *    전체 시장 단가(market)는 쓰지 않아요(공정별 값과 기준이 섞이지 않게)
 *  - 공정이 하나: 시장 단가가 있으면 그 값("market"), 없으면 공공 기준 */
export type StdSource = { src: "parts" | "market" | "public"; total: number; per: Record<string, number> | null };
export function stdSource(d: {
  view: { total: number; sum?: { total: number }; parts?: { trade: string; total: number }[] };
  market: { total: number } | null;
  parts?: { total: number; parts: { trade: string; quote: { total: number } }[] } | null;
}): StdSource {
  const others = d.view.parts ?? [];
  if (others.length) {
    const want = ["dobae", ...others.map((x) => x.trade)];
    const got = d.parts?.parts ?? [];
    if (d.parts && want.every((t) => got.some((x) => x.trade === t))) {
      return { src: "parts", total: d.parts.total, per: Object.fromEntries(got.map((x) => [x.trade, x.quote.total])) };
    }
    return { src: "public", total: d.view.sum?.total ?? d.view.total, per: { dobae: d.view.total, ...Object.fromEntries(others.map((x) => [x.trade, x.total])) } };
  }
  return d.market ? { src: "market", total: d.market.total, per: null } : { src: "public", total: d.view.sum?.total ?? d.view.total, per: null };
}

/** 보드 칸마다 '재재가 챙긴 일'(#234 리뷰): 고른 공정 상태로만 채우고, 그 공정 보드에 없는 칸(maxTab 넘음)은 비워요 */
export function autoDone(st: { asked: boolean; quoted: boolean; deal: boolean; maxTab: number }): Record<number, string[]> {
  const all: Record<number, string[]> = {
    0: ["집 정보 정리"], 1: ["표준견적서 계산"],
    2: st.asked ? ["업체에 실측 날짜 물어보기"] : [],
    4: st.quoted ? ["견적서를 표준견적서와 비교"] : [],
    5: st.deal ? ["확정 공정표 만들기"] : [],
  };
  return Object.fromEntries(Object.entries(all).filter(([k]) => Number(k) <= st.maxTab));
}

/** 내 공사 목록 업체 줄: 담은 업체마다 한 줄, 상태판 줄이 있으면 그 상태. 링크는 그 업체 공정 탭으로(#234 리뷰) */
export function myVendorRows<V extends { visit_id: string; trade: string }, R extends { visit_id: string; status: string }>(
  base: string, vendors: readonly V[], rows: readonly R[] | null,
): { vendor: V; row: R | null; href: string }[] {
  const got = new Map((rows ?? []).map((r) => [r.visit_id, r]));
  return vendors.map((v) => {
    const row = got.get(v.visit_id) ?? null;
    const to = row && (row.status === "offered" || row.status === "proposed") ? `${base}/visits/${encodeURIComponent(v.visit_id)}` : `${base}/visits`;
    return { vendor: v, row, href: withTrade(to, v.trade) };
  });
}
