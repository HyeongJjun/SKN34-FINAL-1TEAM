// 실측 견적 비교(시안 WCompare)에만 쓰는 화면 말 · 표시 함수. 금액 · 퍼센트 · 바뀐 칸은 API(계산 엔진) 값의 형식만 바꾼다.
import type { Schemas } from "@/lib/backend/client";
import { decText, md, stampSeoul, won } from "@/lib/format";

export type Compare = Schemas["CompareDealOut"];
export type Row = Schemas["CompareRowOut"];
export type Quote = Schemas["VendorQuoteOut"];
export type QFile = Schemas["QuoteFileOut"];
export type Past = Schemas["QuoteVersionBrief"];

/** 바로 앞 버전과 달라진 칸 (API changed) */
export const CHANGED_LABEL: Record<string, string> = { total: "낼 금액", days: "공사 기간", valid_until: "유효기간", files: "파일 수" };
export const changedText = (keys: string[]) => keys.map((k) => CHANGED_LABEL[k]).filter(Boolean).join(" · ");

/** 표준견적서 대비: "+18.8%" · "−5.3%" · "0%" (API 퍼센트 그대로, 부호 모양만 바꾼다) */
/** 표준견적서보다 몇 % 많고 적은지 (업체 고르기와 같은 말) */
export function vsPct(vs: string | null, dir: string | null): string | null {
  if (vs == null || !dir) return null;
  if (dir === "same") return "같아요";
  return `${decText(vs.replace(/^[-+]/, ""))}% ${dir === "less" ? "적어요" : "많아요"}`;
}

/** 고객이 낼 금액 꼬리말 */
export const totalTail = (mode: string | null) => (mode === "exempt" ? "면세" : "부가세 포함");

/** 업체가 적은 금액이 부가세 빼고일 때만: "업체가 308만 원(부가세 빼고)으로 적었어요" */
export function enteredText(q: Pick<Quote, "entered_amount" | "vat_mode">): string | null {
  return q.vat_mode === "excluded" && q.entered_amount != null ? `업체가 ${won(q.entered_amount)}(부가세 빼고)으로 적었어요` : null;
}

export type Kind = "pdf" | "sheet" | "photo" | "file";
export function kindOf(contentType: string): Kind {
  if (contentType === "application/pdf") return "pdf";
  if (contentType.includes("spreadsheetml")) return "sheet";
  if (contentType.startsWith("image/")) return "photo";
  return "file";
}
export const KIND_LABEL: Record<Kind, string> = { pdf: "PDF", sheet: "엑셀", photo: "사진", file: "파일" };
/** 브라우저가 바로 그릴 수 있는 사진만 작은 그림으로 보인다 (HEIC는 아이콘) */
export const canThumb = (contentType: string) => ["image/jpeg", "image/png", "image/webp"].includes(contentType);

/** API 시각 → "11.7(토) 20:10" */
export const when = (iso: string | null | undefined) => (iso ? stampSeoul(new Date(iso)) : "");
/** 날짜 "2026-11-21" → "11.21(토)" */
export const day = (iso: string | null | undefined) => (iso ? md(iso.slice(0, 10)) : "");
