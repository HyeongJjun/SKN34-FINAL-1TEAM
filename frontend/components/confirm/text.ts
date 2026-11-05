// 업체 확정(시안 WConfirm)과 확정 뒤 모습(비교 · 업체 고르기 · 실측)에만 쓰는 화면 말 · 표시 함수.
// 날짜 · 기한 · 금액은 API(계산 엔진) 값의 형식만 바꾼다. 서버 · 브라우저 양쪽에서 쓴다.
import { eunNeun, gwaWa } from "@/components/vendors/text";
import type { Schemas } from "@/lib/backend/client";
import { md, stampSeoul } from "@/lib/format";
import { tradeLabel } from "@/lib/labels";

export type Deal = Schemas["DealOut"];
export type ConfirmOut = Schemas["ConfirmOut"];

/** API 시각 → "11.8(일) 10:12" */
export const when = (iso: string | null | undefined) => (iso ? stampSeoul(new Date(iso)) : "");
/** 날짜 "2026-11-16" → "11.16(월)" */
export const day = (iso: string | null | undefined) => (iso ? md(iso.slice(0, 10)) : "");
/** 공사 날짜 "11.16(월) ~ 11.18(수)" (없으면 빈 글) */
export const dates = (d: Pick<Deal, "start_date" | "end_date">) => (d.start_date && d.end_date ? `${day(d.start_date)} ~ ${day(d.end_date)}` : "");

/** 확정 뒤 공사 상태 (고객 쪽 말) */
export const DEAL_LABEL: Record<string, string> = {
  confirmed: "공사 날짜 기다림",
  scheduled: "공사 날짜 수락함",
  checking: "공사 끝냄 · 내 확인 기다림",
  fixing: "남은 일 기다림",
  done: "공사 끝남",
};

/** 업체를 다시 고를 수 있는지 (공사 날짜를 수락하기 전) */
export const canReselect = (d: Pick<Deal, "status">) => d.status === "confirmed";

const HAN = ["", "한", "두", "세"];
/** 확정 전 다시 고르기 확인 창 본문 (시안 WCompare). names는 닫히는 요청의 업체, quoted는 그중 견적서가 온 곳 수 */
export function visitsReselectBody(names: string[], quoted: number): string {
  const wait = names.length - quoted;
  const what = quoted && wait
    ? `받은 실측 견적서 ${quoted}개와 견적서를 기다리는 요청 ${wait}곳이 닫히고`
    : quoted ? `받은 실측 견적서 ${quoted}개가 닫히고` : `견적서를 기다리는 요청 ${wait}곳이 닫히고`;
  const who = names.length === 1 ? gwaWa(names[0]) : `${HAN[names.length] ?? `${names.length}곳`} 업체와`;
  return `${what}, ${who} 서로 보이던 연락처 · 주소가 바로 가려져요. 되돌릴 수 없어요.`;
}

/** 확정 뒤 다시 고르기 확인 창 (시안 WConfirm). 업체가 낸 공사 날짜가 없어지는 안내는 공사 날짜 기능(21번)에서 붙인다 */
export function dealReselectText(d: Pick<Deal, "vendor_name">, other: { trade: string; deal: Pick<Deal, "start_date"> | null } | null) {
  const o = other ? tradeLabel(other.trade) : "";
  return {
    title: `${d.vendor_name} 확정을 풀고 업체 고르기로 돌아갈까요?`,
    body: `${d.vendor_name} 견적서가 닫히고 서로 보이던 연락처 · 주소가 바로 가려져요. 되돌릴 수 없어요.`,
    note: !other ? undefined : other.deal ? (other.deal.start_date ? `${o} 확정과 ${o} 날짜는 그대로예요.` : `${o} 확정은 그대로예요.`) : `${eunNeun(o)} 그대로예요.`,
  };
}
