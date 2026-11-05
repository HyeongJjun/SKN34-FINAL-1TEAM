// 자주 묻는 질문(정적). 답과 근거 문장은 시안(WGuide · 상담 판)에 있는 것만 옮겼다.
// 시안에 답이 없는 질문은 그럴듯한 답을 짓지 않고 '시방서 근거 없음' 모양으로 둔다.
// 첫 화면(/)의 질문 미리 보기와 /faq가 함께 쓴다.

/** short · plain: 첫 화면 미리 보기에서 기준서 번호 · 원문 대신 보이는 이름과 쉬운 말 */
export type FaqRef = { src: string; text: string; quote?: boolean; short?: string; plain?: string };
export type Faq = {
  id: string;
  q: string;
  /** 질문 옆 공정 표시 */
  tag: string;
  /** 답의 공정 */
  trade: string;
  /** 시방서로 만든 자동 답변인지. 아니면 믿집 안내 글이다 */
  auto: boolean;
  /** 글 조각. 숫자는 근거 번호 [n] */
  body: (string | number)[];
  refs?: FaqRef[];
  noBasis?: string;
  ask?: string;
  note?: string;
};
export type FaqGroup = { id: string; title: string; items: Faq[] };

const NO_BASIS = "시방서에서 이 질문의 근거를 찾지 못했어요. 실측 때 업체에 물어보세요.";

export const FAQ: FaqGroup[] = [
  {
    id: "g-dobae",
    title: "도배",
    items: [
      {
        id: "q-bulge",
        q: "도배하고 다음 날 벽지가 울어요. 하자인가요?",
        tag: "도배",
        trade: "도배",
        auto: true,
        body: ["대부분 풀이 마르면서 며칠 안에 펴져요. 그동안 창문을 활짝 열거나 난방을 세게 틀지 마세요.", 1, " 일주일이 지나도 그대로면 업체에 보수를 요청하세요."],
        refs: [{ src: "도배 시방서", text: "햇빛과 바람을 피해 풀을 자연스럽게 충분히 말려야 해요." }],
        note: "하자인지는 집을 본 사람만 알 수 있어요. 이건 시공한 업체에 물어보세요.",
      },
      {
        id: "q-grade",
        q: "저가형과 기본형 도배는 무엇이 달라요?",
        tag: "도배",
        trade: "도배",
        auto: false,
        body: ["저가형은 종이 벽지(합지)예요. 얇아서 벽 굴곡이 비칠 수 있어요. 기본형은 실크 벽지예요. 도톰하고 물걸레로 닦을 수 있어요. 견적 받기에서 고른 유형으로 표준견적서를 계산해요."],
      },
      {
        id: "q-heat",
        q: "도배하고 난방은 언제부터 켜도 돼요?",
        tag: "도배",
        trade: "도배",
        auto: true,
        body: ["시방서에는 도배 전부터 도배 뒤 한동안 방 온도를 알맞게 유지하고, 방이 너무 차면 난방을 준비하라는 기준이 있어요.", 1, 2, " 언제부터 평소처럼 난방해도 되는지는 시방서에 없어서, 시공 업체에 물어보세요."],
        refs: [
          { src: "KCS 41 51 05 도배공사 · 3.1 일반사항 (3)", text: "도배공사를 시작하기 72시간 전부터 시공 후 48시간이 경과할 때까지는 시공 장소의 온도는 담당원과 협의하여 적정온도를 유지하도록 한다.", quote: true },
          { src: "KCS 41 51 05 도배공사 · 3.3 공법 (4) 시공환경 ①", text: "접착제를 이용하는 경우에 시공 도중 또는 접착제 경화 전에 실온이 5 ℃ 이하가 될 경우에는 난방 등의 장치를 준비한다.", quote: true },
        ],
        noBasis: "평소처럼 난방해도 되는 날",
        ask: "도배 뒤 난방은 언제부터, 어느 정도로 켜면 될까요?",
      },
      {
        id: "q-overlay",
        q: "철거를 안 하고 위에 덧바르면 안 돼요?",
        tag: "도배",
        trade: "도배",
        auto: true,
        body: ["시방서는 도배 전에 바탕이 틈이나 요철 없이 평평하고 충분히 말라 있어야 한다고 해요.", 1, " 기존 벽지 위에 덧바를지는 시방서에 없어서, 실측 때 업체가 벽 상태를 보고 정해요."],
        refs: [{ src: "KCS 41 51 05 도배공사 · 3.3 공법 (1) 바탕 점검 ②", text: "미장바탕은 쇠흙손 마감 정도로 주변 구석까지 모두 칠하고 충분히 건조 평활해야 한다.", quote: true }],
        noBasis: "덧바르기 여부",
      },
      {
        id: "q-ceiling",
        q: "천장 도배도 같은 날 같이 해요?",
        tag: "도배",
        trade: "도배",
        auto: true,
        body: [NO_BASIS],
        ask: "천장 도배도 벽 도배와 같은 날 같이 하나요?",
      },
    ],
  },
  {
    id: "g-mok",
    title: "목공",
    items: [
      {
        id: "q-condense",
        q: "베란다 쪽 벽에 결로가 생겨요. 목공 때 막을 수 있나요?",
        tag: "목공",
        trade: "목공",
        auto: true,
        body: [NO_BASIS],
        ask: "베란다 쪽 벽에 생기는 결로를 목공 때 막을 수 있나요?",
      },
      {
        id: "q-molding",
        q: "몰딩을 먼저 바꾸고 도배해야 하나요?",
        tag: "목공 · 도배",
        trade: "도배",
        auto: true,
        body: ["도배는 바탕이 평평하고 충분히 마른 상태인지 점검한 뒤 시작해요.", 1, " 그래서 믿집 공정표도 목공을 먼저 끝내고 도배를 이어서 해요."],
        refs: [{ src: "KCS 41 51 05 도배공사 · 3.3 공법 (1) 바탕 점검 ①", text: "콘크리트 부재는 접합부에 틈새, 요철부, 휘어짐 등이 없이 평활하게 설치되어 있으며 충분히 건조되어야 한다.", quote: true, short: "도배 시방서", plain: "바탕이 평평하고 충분히 말라 있어야 해요." }],
      },
    ],
  },
];

/** 첫 화면 미리 보기에 보이는 질문 */
export const FAQ_PREVIEW = ["q-bulge", "q-molding", "q-grade"];

export function findFaq(id: string): Faq | undefined {
  for (const g of FAQ) for (const it of g.items) if (it.id === id) return it;
  return undefined;
}

/** 찾기: 질문 · 답 · 근거 글에 넣은 말이 들어 있는 질문만 */
export function searchFaq(q: string): FaqGroup[] {
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return FAQ;
  const hay = (it: Faq) => [it.q, it.tag, ...it.body.filter((b) => typeof b === "string"), ...(it.refs ?? []).map((r) => r.text), it.note ?? ""].join(" ").toLowerCase();
  return FAQ.map((g) => ({ ...g, items: g.items.filter((it) => words.every((w) => hay(it).includes(w))) })).filter((g) => g.items.length > 0);
}
