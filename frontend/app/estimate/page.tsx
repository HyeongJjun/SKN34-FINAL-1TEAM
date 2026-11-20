import { AppHeader } from "@/components/site/AppHeader";
import { GuestAskButton } from "@/components/start/GuestAside";
import { MarketQuote } from "@/components/v2/market/MarketQuote";

export const metadata = { title: "표준견적서" };

// 평형이나 면적만 넣으면 도배 · 목공(문 포함) 표준견적서가 바로 나오는 화면. 로그인 없이 쓴다.
// 틀은 내 공사 표준견적서와 같다(머리 · 이동 경로 · 큰 합계 · 줄 표 · 옆 AI 칸).
// 금액은 모두 POST /v2/market-quote(계산 엔진 calc.market_quote, 업체 견적 235건 시장 단가) 응답 그대로다.
export default function EstimatePage() {
  return (
    <>
      <AppHeader phone={{ title: "표준견적서", back: "/start", action: <GuestAskButton /> }} />
      <MarketQuote />
    </>
  );
}
