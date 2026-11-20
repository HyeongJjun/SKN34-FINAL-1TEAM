// 시장 단가 표준견적서(업체 견적서 235건 중앙값, POST /v2/market-quote)를 기본 정보 흐름에 붙이는 변환.
// 기본 정보(면적 · 면적 기준 · 벽지)를 계산 엔진 입력으로 바꾸고, 응답을 견적서 줄 표(QuoteLines) 줄로 바꾼다.
// 금액은 모두 계산 엔진 값이고 여기서 더하거나 반올림하지 않는다.
import type { QuoteLine } from "@/components/ui/QuoteLines";
import type { components } from "@/lib/backend/schema";
import { wonFull } from "@/lib/format";

export type MqIn = components["schemas"]["V2MqIn"];
export type MqOut = components["schemas"]["V2MqOut"];
export type MqTrade = MqOut["trades"][number];

const KIND_KO = { material: "자재", labor: "인건비", expense: "경비" } as const;
export const GROUP_KO: Record<string, string> = {
  base: "기본",
  doors: "방문 교체",
  jungmun: "현관 중문",
  entry_hw: "현관문 철물 교체",
  board: "천장 · 벽 보드 보수",
  insulation: "외벽 단열 보강",
  bath_board: "욕실 천장 방수 보드",
};
const rateText = (r: number) => r.toLocaleString("ko-KR", { style: "percent", maximumFractionDigits: 2 });

/** 기본 정보 → 시장 단가 계산 입력. 기본 정보 흐름은 도배만 고르므로 목공은 끈다. 벽지: economy = 합지, basic = 실크 */
export function toMarketIn(c: { area_m2: string | number; area_basis: string; grade: string | null }): MqIn {
  return {
    area_m2: String(c.area_m2),
    area_basis: c.area_basis === "exclusive" ? "exclusive" : "supply",
    dobae: true,
    mokgong: false,
    wallpaper: c.grade === "economy" ? "hapji" : "silk",
    door: "abs",
    jungmun: "slim3",
    options: null,
  } as MqIn;
}

/** 공종 줄 → 견적서 줄 표 줄. 목공은 묶음 이름(방문 교체 등)을 설명 앞에 붙인다 */
export function tradeLines(t: MqTrade): QuoteLine[] {
  return t.lines.map((l, i) => ({
    key: `${t.key}-${l.item}-${i}`,
    name: l.name,
    note: [t.key === "mokgong" && l.group !== "base" ? GROUP_KO[l.group] ?? l.group : "", l.spec, KIND_KO[l.kind]].filter(Boolean).join(" · "),
    qty: l.qty,
    unit: l.unit,
    unitPrice: l.unit_price,
    amount: l.amount,
    state: "included",
  }));
}

/** 합계 표 줄: 순공사비 → 양식 요율 → 단수 정리 */
export function sumLines(q: MqOut): QuoteLine[] {
  return [
    { key: "net", name: "순공사비", note: `자재 ${wonFull(q.material)} · 인건비 ${wonFull(q.labor)} · 경비 ${wonFull(q.expense)}`, amount: q.net, state: "included" },
    ...q.overheads.map((o): QuoteLine => ({ key: o.key, name: `${o.name} (${rateText(o.rate)})`, note: "순공사비 × 요율", amount: o.amount, state: "included" })),
    ...(q.cut ? [{ key: "cut", name: "단수 정리", note: "만 원 아래 버림", amount: q.cut, state: "included" } as QuoteLine] : []),
  ];
}
