// 기준점(dev-08 · design-03). CSS 미디어 쿼리 값과 같아요: 폰 < 768 · 태블릿 768~1023 · 웹 ≥ 1024 · 넓은 웹 ≥ 1280.
// 배치는 CSS로 바꾸는 것이 기본이에요. 스크립트가 알아야 할 때(아래 시트 ↔ 작은 메뉴, 끌어다 놓기)만 이 값을 써요.
// 브라우저에서 맞는지 볼 때는 ./useMedia의 useMedia(MQ.tablet)을 써요.

export const BP = { tablet: 768, web: 1024, wide: 1280 } as const;

export const MQ = {
  /** 태블릿 이상: 웹 머리 · 가운데 창 · 작은 메뉴 */
  tablet: `(min-width: ${BP.tablet}px)`,
  /** 웹: 본문 + 옆 칸 · 공사 띠 전부 */
  web: `(min-width: ${BP.web}px)`,
  wide: `(min-width: ${BP.wide}px)`,
  /** 손가락으로 누르는 기기: 끌어다 놓기 대신 눌러서 고르기 */
  coarse: "(pointer: coarse)",
} as const;
