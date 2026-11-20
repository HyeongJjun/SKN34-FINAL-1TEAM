import { SheetPage } from "@/components/v2/sheet/SheetPage";
import { requireRole } from "@/lib/session";

export const metadata = { title: "표준견적서 쉽게 보기" };

// 상담(/v2)에서 만든 표준견적서를 팀 양식(공정별 자재비 · 시공비 · 경비 + 요율)으로 풀어 보인다.
// 금액은 모두 POST /v2/quote-sheet(계산 엔진) 응답 그대로다.
export default async function V2StandardPage() {
  await requireRole("customer", "/v2/standard");
  return <SheetPage />;
}
