// 자주 묻는 질문(C54) — 9판의 6개. 답은 지금 규칙(표준견적서는 참고 금액 · 업체에는 동네까지만 · 동 · 호수 · 연락처는 고객이 채팅으로 · 결제는 범위 밖)에 맞춰 썼어요.
// 숫자(금액 · 기간)는 쓰지 않아요. /faq와 로그인 전 'AI에게 묻기' 칩(C58 · D12)이 같이 써요.
export type FaqCat = "quote" | "vendor" | "visit" | "me";
export type FaqItem = { id: string; cat: FaqCat; q: string; a: string };

export const FAQ_CATS: { key: FaqCat | "all"; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "quote", label: "견적" },
  { key: "vendor", label: "업체" },
  { key: "visit", label: "실측" },
  { key: "me", label: "내 정보" },
];

export const FAQ_V3: FaqItem[] = [
  { id: "q-standard", cat: "quote", q: "표준견적서는 업체 견적이에요?", a: "아니요. 시장 데이터 기준 단가로 믿집이 계산한 참고 금액이에요. 업체 견적은 실측 뒤에 받아요." },
  { id: "q-estimate", cat: "quote", q: "가견적은 어떻게 나와요?", a: "업체가 직접 넣고 확인한 단가에 믿집이 센 수량을 곱해 계산해요. 실측 전 금액이라 실측 뒤 업체 견적서와 달라질 수 있어요." },
  { id: "q-visit-fee", cat: "visit", q: "실측은 돈이 들어요?", a: "업체마다 달라요. 업체 목록과 업체 자세히에 '실측 무료'인지, 출장비가 있는지 보여요." },
  { id: "q-vendor-check", cat: "vendor", q: "업체는 어떻게 확인해요?", a: "믿집이 사업자등록증을 보고 승인한 업체만 보여요. 업체 자세히에서 시공 사례 · 리뷰 · 사업자 정보를 볼 수 있어요." },
  { id: "q-contact", cat: "me", q: "내 연락처는 언제 업체에 가요?", a: "믿집은 동네(구 · 동) · 면적 · 집 상태 · 사진만 업체에 줘요. 예산은 요청서에 함께 가요. 동 · 호수 · 연락처는 실측 날짜가 정해진 뒤 채팅에서 직접 알려 줘요." },
  { id: "q-payment", cat: "quote", q: "결제도 믿집에서 해요?", a: "아니요. 돈은 업체와 직접 주고받아요." },
];

/** 로그인 전 'AI에게 묻기'(C58 · D12)에 보이는 질문 세 개 */
export const GUEST_CHIPS = ["q-standard", "q-estimate", "q-visit-fee"];

export const faqById = (id: string) => FAQ_V3.find((f) => f.id === id);
