// 서버 쪽 읽기: 표준견적서 · 업체 실측 견적서 · 실측 견적서 비교.
import { serverGet, type Schemas } from "@/lib/backend/server";
import { isUuid } from "./project";

export type ApiStandard = Schemas["StandardOut"];
/** 표준견적서 (믿집 계산). 없거나 남의 것이면 null */
export async function getStandard(projectId: string) {
  return isUuid(projectId) ? serverGet<ApiStandard>(`/projects/${projectId}/standard`) : null;
}

export type VendorQuoteBoard = Schemas["QuoteBoardOut"];
/** 업체: 이 요청의 실측 견적서(임시 저장본 · 보낸 버전 · 칸 한도). 내 요청이 아니면 null */
export async function getMyQuoteBoard(visitId: string) {
  return isUuid(visitId) ? serverGet<VendorQuoteBoard>(`/vendor/visits/${visitId}/quote`) : null;
}

export type QuoteCompare = Schemas["CompareDealOut"];
/** 고객: 한 공정의 실측 견적서 비교(표준견적서 · 업체마다 최신 버전 · 이전 버전). 남의 공사 · 고르지 않은 공정이면 null */
export async function getQuoteCompare(projectId: string, trade: "dobae" | "mokgong") {
  return isUuid(projectId) ? serverGet<QuoteCompare>(`/projects/${projectId}/quotes?trade=${trade}`) : null;
}
