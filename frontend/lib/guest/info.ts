// 기본 정보(C02 · D11) 값 · 검사 · 요약 글. 서버 · 브라우저가 같이 써요.
// 금액 · 수량은 여기서 만들지 않아요(서버 계산 엔진). 단위만 바꿔요: 평 → ㎡(넣기 도움, C03) · 만 원 → 원(예산 칸).
// 칸 이름은 API HomeInfoIn과 같아요(dev-03 mj_guest_v3 info). 넣는 동안은 덜 찬 값도 두니 Draft로 따로 둬요.
import type { Schemas } from "@/lib/backend/client";
import { dateShort, won } from "@/lib/format";

export type HomeInfo = Schemas["HomeInfoIn"];
export type HomeInfoSaved = Schemas["HomeInfoOut"];
export type SpaceKind = HomeInfo["spaces"][number];
export type Face = HomeInfo["faces"][number];
export type Grade = HomeInfo["grade"];
export type Basis = HomeInfo["area_basis"];
/** 목공 할 곳(#193): 몰딩 · 걸레받이 · 문 · 벽 평탄화 */
export type MokItem = NonNullable<HomeInfo["mokgong"]>[number];
export const MOK_ITEMS: { key: MokItem; label: string }[] = [
  { key: "molding", label: "몰딩" }, { key: "base", label: "걸레받이" }, { key: "door", label: "문 · 문틀" }, { key: "flatten", label: "벽 평탄화" },
];

/** 넣는 중인 답(기기에 저장하는 모양). 다 차면 toHomeInfo로 API 몸통이 돼요 */
export type InfoDraft = {
  scope: "full" | "partial";
  spaces: SpaceKind[];
  faces: Face[];
  sido: string;
  sgg: string;
  emd: string;
  /** 사람이 넣은 ㎡ 글 그대로("69.4") */
  area: string;
  basis: Basis;
  occupied: boolean | null;
  grade: Grade | null;
  /** 만 원 글 그대로("300"). 비우면 '아직 몰라요' */
  budget: string;
  /** 서울 날짜 "2027-01-04". 비우면 '아직 몰라요' */
  start: string | null;
  /** 목공도 해요(#193). 켜면 할 곳을 하나 이상 골라요 */
  mok: boolean;
  mokgong: MokItem[];
};

export const EMPTY_DRAFT: InfoDraft = {
  scope: "full", spaces: [], faces: ["wall", "ceiling"], sido: "", sgg: "", emd: "",
  area: "", basis: "supply", occupied: null, grade: null, budget: "", start: null, mok: false, mokgong: [],
};

export const SPACES: { key: SpaceKind; label: string }[] = [
  { key: "living", label: "거실" }, { key: "kitchen", label: "주방" }, { key: "master", label: "안방" },
  { key: "room1", label: "작은방 1" }, { key: "room2", label: "작은방 2" }, { key: "hall", label: "복도" },
  { key: "entry", label: "현관" }, { key: "dress", label: "드레스룸" },
];
export const FACES: { key: Face; label: string }[] = [{ key: "wall", label: "벽" }, { key: "ceiling", label: "천장" }];
export const spaceLabel = (k: string) => SPACES.find((s) => s.key === k)?.label ?? k;
export const GRADE_WORD: Record<Grade, string> = { economy: "합지", basic: "실크" };

/** 면 글: 벽 + 천장 · 벽만 · 천장만 */
export function facesText(faces: readonly string[]): string {
  const w = faces.includes("wall");
  const c = faces.includes("ceiling");
  return w && c ? "벽 + 천장" : w ? "벽만" : c ? "천장만" : "";
}

/** 공사 범위 글: '전체 · 벽 + 천장' · '부분 · 거실 · 주방 · 벽만' */
export function scopeText(d: Pick<InfoDraft, "scope" | "spaces" | "faces">): string {
  if (d.scope === "full") return "전체 · 벽 + 천장";
  return ["부분", ...d.spaces.map(spaceLabel), facesText(d.faces)].filter(Boolean).join(" · ");
}

/** ㎡ 글 → 화면 글 "69.4" (끝 0 정리 없이 넣은 그대로, 소수 한 자리) */
const AREA_RE = /^\d{1,3}(\.\d)?$/;

/** 평 → ㎡ 넣기 도움(C03): 21 → "69.4". 계산 · 견적서는 ㎡로 하고, 평은 넣을 때만 써요. 숫자가 아니면 null */
export const PYEONG_M2 = 3.3058;
export function pyeongToM2(p: string): string | null {
  const n = Number(p.trim());
  if (!p.trim() || !Number.isFinite(n) || n <= 0 || n >= 1000) return null;
  return (Math.round(n * PYEONG_M2 * 10) / 10).toFixed(1);
}

/** 숫자 뒤 을/를: 마지막 자리를 읽는 소리로 골라요(69.4 → 를, 70 → 을) */
export function numEulReul(n: string): string {
  const last = n.trim().slice(-1);
  return "2459".includes(last) ? "를" : "을";
}

/** 만 원 글 → 원(서버 칸 budget_won). 비우면 null */
export function budgetWon(budget: string): number | null {
  const t = budget.replace(/[,\s]/g, "");
  return t ? Number(t) * 10000 : null;
}

export type InfoErrors = Partial<Record<"spaces" | "faces" | "region" | "area" | "occupied" | "grade" | "budget" | "mokgong", string>>;
/** 틀린 칸 순서(첫 칸으로 초점을 옮겨요, I6 B) */
export const ERROR_ORDER: (keyof InfoErrors)[] = ["spaces", "faces", "region", "area", "occupied", "grade", "mokgong", "budget"];
export const ERROR_NAME: Record<keyof InfoErrors, string> = { spaces: "공간", faces: "면", region: "지역", area: "면적", occupied: "공사할 때 집", grade: "벽지", budget: "예산", mokgong: "목공 할 곳" };

/** 제출할 때 한 번 검사해요(I6 B). 오류 글은 [무엇이 문제] + [고치는 법](U5) */
export function checkDraft(d: InfoDraft): InfoErrors {
  const e: InfoErrors = {};
  if (d.scope === "partial") {
    if (!d.spaces.length) e.spaces = "공간을 하나 이상 골라 주세요.";
    if (!d.faces.length) e.faces = "벽 · 천장 중 하나 이상 골라 주세요.";
  }
  if (!d.sido || !d.sgg) e.region = "지역을 골라 주세요. 시 · 도와 시 · 군 · 구를 골라요.";
  const a = d.area.trim();
  const n = Number(a);
  const guessText = (v: number) => v.toFixed(1).replace(/\.0$/, "");
  if (!a) e.area = "면적을 ㎡로 넣어 주세요. 평만 알면 '평으로 넣기'를 써요.";
  else if (!/^\d+(\.\d+)?$/.test(a) || !Number.isFinite(n)) e.area = "숫자로 넣어 주세요. 예: 69.4";
  else if (n <= 10) {
    const g = guessText(n * 10);
    e.area = n * 10 > 10 && n * 10 < 400 ? `방 한 칸보다 작아요. ${g}${numEulReul(g)} 넣으려던 건가요?` : "방 한 칸보다 작아요. 10㎡보다 크게 넣어 주세요.";
  } else if (n >= 400) {
    const g = guessText(n / 10);
    e.area = n / 10 > 10 && n / 10 < 400 ? `아파트 한 집보다 커요. ${g}${numEulReul(g)} 넣으려던 건가요?` : "400㎡보다 작게 넣어 주세요.";
  } else if (!AREA_RE.test(a)) e.area = "소수점은 한 자리까지 넣어 주세요. 예: 69.4";
  if (d.occupied === null) e.occupied = "공사할 때 집에 사는지 골라 주세요.";
  if (!d.grade) e.grade = "벽지를 골라 주세요. 합지 · 실크 중 하나예요.";
  if (d.mok && !d.mokgong.length) e.mokgong = "목공 할 곳을 하나 이상 골라 주세요.";
  const b = d.budget.replace(/[,\s]/g, "");
  if (b) {
    if (!/^\d{1,6}$/.test(b)) e.budget = "예산은 만 원 단위 숫자로 넣어 주세요. 예: 300";
    else if (Number(b) < 10) e.budget = "예산은 10만 원부터 넣을 수 있어요. 모르면 '아직 몰라요'를 골라요.";
  }
  return e;
}

/** 검사를 지난 답 → API 몸통(POST /guest/standard · POST /projects와 같은 칸) */
export function toHomeInfo(d: InfoDraft): HomeInfo {
  const partial = d.scope === "partial";
  return {
    trade: "dobae",
    scope: d.scope,
    spaces: partial ? d.spaces : [],
    faces: partial ? d.faces : ["wall", "ceiling"],
    housing: "apt",
    sido: d.sido,
    sgg: d.sgg, // 동은 보내지 않아요(시 · 군 · 구까지만 받아요)
    area_m2: d.area.trim(),
    area_basis: d.basis,
    occupied: d.occupied === true,
    grade: d.grade ?? "basic",
    budget_won: budgetWon(d.budget),
    start_date: d.start,
    mokgong: d.mok ? d.mokgong : [],
  };
}

/** 저장된 공사의 v3 기본 정보 → 넣는 중인 답(고치기 C02 · ?edit=) */
export function fromSaved(h: HomeInfoSaved): InfoDraft {
  return {
    scope: h.scope,
    spaces: h.spaces,
    faces: h.faces.length ? h.faces : ["wall", "ceiling"],
    sido: h.sido,
    sgg: h.sgg,
    emd: h.emd ?? "",
    area: String(h.area_m2).replace(/(\.\d)0+$/, "$1"),
    basis: h.area_basis === "exclusive" ? "exclusive" : "supply",
    occupied: h.occupied,
    grade: h.grade,
    budget: h.budget_won ? String(Math.round(h.budget_won / 10000)) : "",
    start: h.start_date,
    mok: (h.mokgong ?? []).length > 0,
    mokgong: h.mokgong ?? [],
  };
}

const placeOf = (d: Pick<InfoDraft, "sgg">) => d.sgg;
const areaOf = (d: Pick<InfoDraft, "area" | "basis">) => (d.area.trim() ? `${d.basis === "exclusive" ? "전용" : "공급"} ${d.area.trim()}㎡` : "");

/** 폰 아래 띠 요약 한 줄(C02): '도배 · 전체 · 벽 + 천장 · 아파트 · 상계동 공급 69.4㎡ · 빈 집 · 실크 · 예산 300만 원 · 1.4(월) 시작'. 안 넣은 칸은 빼요 */
export function summaryLine(d: InfoDraft): string {
  const place = [placeOf(d), areaOf(d)].filter(Boolean).join(" ");
  const budget = budgetWon(d.budget);
  return [
    "도배",
    scopeText(d),
    "아파트",
    place,
    d.occupied === null ? "" : d.occupied ? "사는 중" : "빈 집",
    d.grade ? GRADE_WORD[d.grade] : "",
    budget ? `예산 ${won(budget)}` : "",
    d.start ? `${dateShort(d.start)} 시작` : "",
  ].filter(Boolean).join(" · ");
}

/** 웹 '넣은 내용' 칸(D11) · 잠긴 기본 정보(C50)가 같이 쓰는 줄 */
export function summaryRows(d: InfoDraft, opts: { longDate?: string; fullRegion?: string } = {}): { label: string; value: string; sub?: string }[] {
  const budget = budgetWon(d.budget);
  return [
    { label: "공사 종류", value: "도배" },
    { label: "공사 범위", value: scopeText(d) },
    { label: "주거 종류", value: "아파트" },
    { label: "지역", value: opts.fullRegion ?? placeOf(d) },
    { label: "면적", value: areaOf(d) },
    { label: "공사할 때 집", value: d.occupied === null ? "" : d.occupied ? "사는 중" : "빈 집" },
    { label: "벽지", value: d.grade ? GRADE_WORD[d.grade] : "" },
    { label: "예산", value: budget ? won(budget) : d.budget.trim() ? "" : "아직 몰라요" },
    { label: "공사 시작 희망일", value: d.start ? opts.longDate ?? dateShort(d.start) : "아직 몰라요" },
  ];
}

type RegionList = { id: string; name: string; groups: { prefix: string; items: string[] }[] }[];
/** 지역 글 '서울 노원구' · '광주 광산구' · '세종 세종시'(지역 표의 이름을 써요, 동은 받지 않아요) */
export function placeText(regions: RegionList, p: { sido: string; sgg: string }): string {
  const r = regions.find((x) => x.id === p.sido);
  if (!r) return "";
  const g = r.groups.find((x) => x.items.includes(p.sgg));
  const head = p.sgg ? (g?.prefix ? [g.prefix, p.sgg] : [r.name, p.sgg]) : [r.name];
  return head.filter(Boolean).join(" ");
}

export const STEP_NAMES = ["집", "견적", "업체", "실측", "비교", "일정", "공사", "완료"];
/** API 단계 번호(MyProjectOut.current, 1~8) → 단계 칸(0~7) */
export const stepIndex = (current: number | null | undefined): number => Math.max(0, Math.min(STEP_NAMES.length - 1, (current ?? 3) - 1));
/** API 단계 번호 → 단계 이름 '업체 담기' */
export const stepName = (current: number | null | undefined): string => STEP_NAMES[stepIndex(current)];

/** 공사 이름 '상계동 아파트 도배'(동이 없으면 구) */
export function projectName(emd: string | null | undefined, region: string, trades: string[]): string {
  const place = emd || region.split(" ").at(-1) || region;
  const t = trades.length ? trades.map((k) => (k === "dobae" ? "도배" : k === "mokgong" ? "목공" : k)).join(" · ") : "도배";
  return `${place} 아파트 ${t}`;
}

/** 표준견적서 위 '이 조건으로 계산했어요' 줄(C07 · C57 · C60): '도배 전체 · 아파트 공급 69.4㎡ · 실크 · 빈 집' */
export function conditionText(h: { scope: string; spaces: readonly string[]; faces: readonly string[]; area_m2: string | number; area_basis: string; grade: string | null; occupied: boolean }): string {
  const area = `${h.area_basis === "exclusive" ? "전용" : "공급"} ${String(h.area_m2).replace(/(\.\d)0+$/, "$1")}㎡`;
  const grade = h.grade === "economy" || h.grade === "basic" ? GRADE_WORD[h.grade] : "";
  if (h.scope === "partial") {
    return [`도배 부분`, ...h.spaces.map(spaceLabel), facesText(h.faces), `아파트 ${area}`, grade].filter(Boolean).join(" · ");
  }
  return [`도배 전체`, `아파트 ${area}`, grade, h.occupied ? "사는 중" : "빈 집"].filter(Boolean).join(" · ");
}
