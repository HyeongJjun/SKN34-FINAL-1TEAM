// B2b 예시 데이터 스위치(개발에서만). 실측 일정 · 채팅 · 실측 뒤 · 내 공사 · 알림 화면이 API(schema.d.ts) 모양 그대로의 예시를 읽어요.
// - 켜기: NEXT_PUBLIC_MJ_MOCK=1 로 next dev를 띄워요. next build(운영)에서는 늘 꺼져요(NODE_ENV=production).
// - 읽기는 lib/api/<영역>.ts 안에서만 예시 ↔ 실제를 바꿔요. 쓰기는 lib/mock/v3b/client.ts의 act()가 예시 단계를 넘겨요.
// - 9판 이야기(J5 · J6 · J7 · J12 · J14 · J22)를 단계(STEPS)로 나눠 두었어요. 지금 단계는 쿠키 mj_v3b_step(없으면 board1)이에요.

export const MOCK_V3B = process.env.NEXT_PUBLIC_MJ_MOCK === "1" && process.env.NODE_ENV !== "production";

export const STEP_COOKIE = "mj_v3b_step";

/** 이야기 단계: 키 · 그 단계의 '지금'(서울 시각) · 짧은 설명 */
export const STEPS = [
  { key: "req", at: "2026-11-17T21:30:00+09:00", label: "담은 2곳 · 요청 전" },
  { key: "sent", at: "2026-11-17T21:40:00+09:00", label: "요청 보냄 · 두 곳 답 기다림" },
  { key: "board1", at: "2026-11-18T09:20:00+09:00", label: "마루와벽 기간 답 · 결도배 답 기다림" },
  { key: "done", at: "2026-11-18T11:05:00+09:00", label: "마루와벽 실측 확정" },
  { key: "board_exp", at: "2026-11-19T21:45:00+09:00", label: "결도배 답 없음" },
  { key: "pick_off", at: "2026-11-20T15:00:00+09:00", label: "결도배 한 번 더 · 기간 답(바로 확정 끔)" },
  { key: "picked", at: "2026-11-20T15:10:00+09:00", label: "결도배 수락 기다림" },
  { key: "board_prop", at: "2026-11-21T10:15:00+09:00", label: "결도배 다른 날 제안" },
  { key: "both_booked", at: "2026-11-21T10:40:00+09:00", label: "두 곳 실측 확정 · 채팅" },
  { key: "change", at: "2026-12-10T14:20:00+09:00", label: "마루와벽 일정 바꾸기 요청" },
  { key: "visited", at: "2026-12-15T14:00:00+09:00", label: "마루와벽 실측 시각 지남" },
  { key: "waiting_quote", at: "2026-12-15T14:05:00+09:00", label: "마루와벽 견적서 기다림" },
  { key: "quotes", at: "2026-12-17T09:20:00+09:00", label: "실측 견적서 2곳" },
  { key: "confirmed", at: "2026-12-17T10:05:00+09:00", label: "마루와벽 확정 · 공사 날짜 기다림" },
  { key: "dates", at: "2026-12-17T15:20:00+09:00", label: "공사 날짜 올라옴" },
  { key: "date_req", at: "2026-12-17T15:40:00+09:00", label: "다른 날짜 요청함" },
  { key: "scheduled", at: "2026-12-17T16:00:00+09:00", label: "공사 날짜 수락" },
  { key: "extra", at: "2027-01-04T11:00:00+09:00", label: "추가 금액 올라옴" },
  { key: "extra_ok", at: "2027-01-04T11:10:00+09:00", label: "추가 금액 승인" },
  { key: "done_ok", at: "2027-01-05T17:00:00+09:00", label: "공사 끝 알림" },
  { key: "review", at: "2027-01-05T17:30:00+09:00", label: "공사 끝 · 리뷰 쓰기" },
  { key: "reviewed", at: "2027-01-05T17:40:00+09:00", label: "리뷰 올림" },
] as const;

export type StepKey = (typeof STEPS)[number]["key"];
export const DEFAULT_STEP: StepKey = "board1";
export const isStep = (v: string | null | undefined): v is StepKey => STEPS.some((s) => s.key === v);
