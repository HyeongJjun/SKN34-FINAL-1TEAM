// 실측 견적서 올리기(시안 WVQuote)에만 쓰는 화면 말 · 표시 함수. 금액은 API가 계산한 값만 보이고 새로 계산하지 않는다.
import type { Schemas } from "@/lib/backend/client";
import { won } from "@/lib/format";

export type Board = Schemas["QuoteBoardOut"];
export type Version = Schemas["VendorQuoteOut"];
export type QFile = Schemas["QuoteFileOut"];
export type Body = Schemas["QuoteDraftIn"];
export type VatMode = NonNullable<Body["vat_mode"]>;

/** 칸 이름 (API 오류의 loc · code와 같다. 파일은 files) */
export type Key = "files" | "measured_on" | "entered_amount" | "vat_mode" | "days" | "valid_until";
export type Errs = Partial<Record<Key, string>>;
/** 보낼 때 꼭 있어야 하는 칸 (backend quote.service MISSING과 같은 문장) */
export const MISSING: Partial<Record<Key, string>> = {
  files: "견적서 파일을 하나 이상 올려 주세요.",
  entered_amount: "낼 금액을 넣어 주세요.",
  vat_mode: "넣은 금액이 부가세 포함인지 골라 주세요.",
};
/** 화면 위에서 아래 순서 (빠진 칸이 여럿이면 맨 위 칸으로 옮겨 간다) */
export const ORDER: Key[] = ["files", "measured_on", "entered_amount", "vat_mode", "days", "valid_until"];

export const VAT_LABEL: Record<VatMode, string> = { included: "부가세 포함", excluded: "부가세 빼고", exempt: "면세(간이과세 등)" };
const ENTERED: Record<string, string> = { included: "부가세 포함으로 넣었어요", excluded: "부가세 빼고 넣었어요", exempt: "면세로 넣었어요" };

/** 고객이 보는 낼 금액: "338만 8,000원" + "부가세 포함" · "면세" */
export const totalTail = (mode: string | null) => (mode === "exempt" ? "면세" : "부가세 포함");
/** 업체가 넣은 금액: "308만 원 · 부가세 빼고 넣었어요" */
export function enteredText(q: Pick<Version, "entered_amount" | "vat_mode">): string | null {
  if (q.entered_amount == null || !q.vat_mode) return null;
  return `${won(q.entered_amount)} · ${ENTERED[q.vat_mode] ?? ""}`;
}

/** 서버가 받는 낼 금액 한도 (backend quote.schemas AMOUNT_MAX) */
export const AMOUNT_MAX = 1_000_000_000;
/** 숫자만 남긴다(10자리까지). "3,080,000원" → "3080000" */
export const amountDigits = (v: string) => v.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 10);
/** 일 수 칸: 숫자 3자리까지 */
export const dayDigits = (v: string) => v.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 3);

/** 요청 상태 → 이 화면에서 할 수 있는 일 */
export const CLOSED = new Set(["cancelled", "declined", "closed"]);

/** 고객이 확정한 뒤 (backend visit.service CLOSED_FOR_QUOTE["chosen"]과 같은 문장) */
export const CHOSEN_TEXT = "고객이 확정해서 다시 올릴 수 없어요.";

/** 다시 올리기: 보낸 버전의 칸과 파일로 다음 버전 임시 저장본을 만든다(같은 요청의 버전끼리는 파일을 같이 쓴다). */
export function resendBody(q: Version, modes: VatMode[]): Body {
  const mode = q.vat_mode as VatMode | null;
  return {
    file_ids: [...q.files].sort((a, b) => a.sort - b.sort).map((f) => f.file_id),
    measured_on: q.measured_on,
    entered_amount: q.entered_amount,
    vat_mode: mode && modes.includes(mode) ? mode : null,
    days: q.days,
    valid_until: q.valid_until,
  };
}
