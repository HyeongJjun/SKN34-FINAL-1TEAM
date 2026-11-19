// 채팅 화면 말 · 말풍선 묶기(U7: 시각은 말풍선 밖 시:분만, 같은 사람 · 같은 분이면 마지막 말에만 · 날짜가 바뀌면 날짜 줄).
// 시각 · 날짜는 API가 준 값을 서울 기준으로 모양만 바꿔요(lib/format).
import { dateLong, dateSeoul, timeSeoul } from "@/lib/format";

type Msg = { seq: number; from: "me" | "them" | "system"; kind: "text" | "photo" | "system"; system_code: string | null; at: string };

/** 시스템 카드 기본 말(body가 없을 때). 코드는 backend thread.models SYSTEM_CODES */
const SYSTEM_TEXT: Record<string, string> = {
  visit_booked: "실측 날짜가 정해졌어요",
  change_requested: "일정 바꾸기 요청",
  change_done: "실측 일정이 바뀌었어요",
  change_countered: "업체가 다른 날을 제안했어요",
  visit_cancelled: "실측이 취소됐어요",
  quote_sent: "실측 견적서가 왔어요",
  extra_sent: "추가 금액이 올라왔어요",
  extra_asked: "추가 금액을 채팅으로 물어봐요",
  deal_confirmed: "업체를 확정했어요",
  other_chosen: "다른 업체로 확정해서 이 채팅은 읽기만 돼요",
};
export const systemText = (code: string | null, body: string | null) => body || (code ? SYSTEM_TEXT[code] : null) || "알림";

/** 읽기만일 때 입력 칸 자리 한 줄(ro_reason) */
export function readOnlyText(role: "customer" | "vendor", reason: string | null, blocked: boolean): string {
  if (reason === "blocked" || blocked) return role === "customer" ? "이 업체를 차단해서 채팅을 받지 않아요" : "고객이 채팅을 막았어요";
  switch (reason) {
    case "other_chosen": return role === "customer" ? "다른 업체로 확정해서 이 채팅은 읽기만 돼요" : "고객이 다른 업체로 확정해서 읽기만 돼요";
    case "cancelled": return "실측이 취소돼서 이 채팅은 읽기만 돼요";
    case "declined": return "업체가 요청을 받지 않아서 읽기만 돼요";
    case "withdrawn": return "고객이 탈퇴해서 읽기만 돼요";
    case "admin": return "믿집이 이 채팅을 멈췄어요";
    default: return "지금은 글을 보낼 수 없어요";
  }
}

/** 빠른 답(화면 상수, api.md 7장) — 고객 · 실측 전 · 쓸 수 있을 때만 */
export const QUICK_REPLIES = ["도착 전에 연락 주세요", "주차 안내를 보낼게요"] as const;

/** 글 1,000자까지(backend thread.models BODY_MAX) */
export const BODY_MAX = 1000;

const minuteOf = (at: string) => `${dateSeoul(at)} ${timeSeoul(at)}`;

export type Item<M extends Msg> =
  | { type: "day"; key: string; label: string; iso: string }
  | { type: "sys"; key: string; msg: M }
  | { type: "bub"; key: string; msg: M; time: string | null; gap: boolean; first: boolean };

/** 글 목록 → 날짜 줄 · 시스템 줄 · 말풍선(시각을 붙일지 · 사람이 바뀌는지) */
export function toItems<M extends Msg>(list: M[], keyOf: (m: M) => string): Item<M>[] {
  const out: Item<M>[] = [];
  let day = "";
  list.forEach((m, i) => {
    const d = dateSeoul(m.at);
    if (d !== day) {
      day = d;
      out.push({ type: "day", key: `d-${d}`, label: dateLong(d), iso: d });
    }
    if (m.from === "system" || m.kind === "system") {
      out.push({ type: "sys", key: keyOf(m), msg: m });
      return;
    }
    const prev = list[i - 1];
    const next = list[i + 1];
    const sameAsPrev = prev && prev.from === m.from && prev.kind !== "system" && dateSeoul(prev.at) === d;
    const sameMinuteNext = next && next.from === m.from && next.kind !== "system" && minuteOf(next.at) === minuteOf(m.at);
    out.push({ type: "bub", key: keyOf(m), msg: m, time: sameMinuteNext ? null : timeSeoul(m.at), gap: !sameAsPrev && i > 0, first: !sameAsPrev });
  });
  return out;
}

/** 목록 줄 시각: 오늘이면 '10:31', 아니면 '11.18'(9판 C24). today는 서버가 준 서울 날짜 */
export function listTime(at: string, today: string): string {
  const d = dateSeoul(at);
  if (d === today) return timeSeoul(at);
  const [y, m, dd] = d.split("-").map(Number);
  return today.slice(0, 4) === String(y) ? `${m}.${dd}` : `${y}.${m}.${dd}`;
}
