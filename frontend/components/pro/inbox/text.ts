// 작업함 · 요청 자세히(시안 WVInbox)에만 쓰는 화면 말 · 표시 함수. 날짜 · 금액은 새로 계산하지 않고 형식만 바꾼다.
import type { Schemas } from "@/lib/backend/client";
import { dateSeoul, dayParts, decText, dotDate, md, stampSeoul } from "@/lib/format";
import { gradeLabel, tradeLabel } from "@/lib/labels";

export type Row = Schemas["InboxRowOut"];
export type Detail = Schemas["VendorVisitDetailOut"];
export type Tab = "todo" | "waiting" | "jobs" | "done";

export const TABS: { k: Tab; t: string }[] = [
  { k: "todo", t: "할 일" },
  { k: "waiting", t: "기다림" },
  { k: "jobs", t: "공사" },
  { k: "done", t: "끝남" },
];

/** 탭이 비었을 때 */
export const EMPTY: Record<Tab, string> = {
  todo: "지금 할 일이 없어요. 새 실측 요청이 오면 알림으로 알려 드려요.",
  waiting: "고객의 결정을 기다리는 일이 없어요.",
  jobs: "확정된 공사가 없어요.",
  done: "끝난 일이 아직 없어요.",
};

/** 끝남 탭 다음 쪽 크기 (API 기본값과 같다) */
export const PAGE = 20;

/** 연락처 기한 "2027.11.23(화)" (API 값 그대로, 형식만) */
export const untilDay = (iso: string) => `${dotDate(iso)}(${dayParts(iso).w})`;

/** 고객이 확인해 끝난 공사: "11.23(월) 끝냄 · 연락처는 2027.11.23(화)까지" (끝낸 날 · 기한은 API 값) */
export function doneNote(v: Pick<Row, "work_done_on" | "contact_until">): string {
  const on = v.work_done_on ? `${md(v.work_done_on)} 끝냄` : "끝냄";
  return v.contact_until ? `${on} · 연락처는 ${untilDay(v.contact_until)}까지` : on;
}

/** 닫힌 요청 · 끝난 공사가 어떻게 끝났나 */
export function endLabel(v: Pick<Row, "status" | "close_reason" | "deal_status">): string {
  if (v.deal_status === "done") return "공사 끝남";
  if (v.status === "cancelled") return "요청이 취소됐어요";
  if (v.status === "declined") return "내가 받지 않았어요";
  if (v.close_reason === "reselected") return "고객이 업체를 다시 고르기로 했어요";
  return "다른 업체로 정했어요";
}

/** "10.29(목) 닫힘" */
export function endNote(v: Pick<Row, "closed_at">): string {
  return v.closed_at ? `${md(dateSeoul(v.closed_at))} 닫힘` : "닫힘";
}

export const isDone = (status: string) => status === "cancelled" || status === "declined" || status === "closed";

/** 공사 탭 '다음 할 일' (공사 날짜를 낸 뒤의 일은 공사 일정 화면에서 한다) */
export const JOB_LABEL: Record<string, string> = {
  confirmed: "공사 날짜 내기",
  scheduled: "공사 날짜 확정",
  checking: "공사 끝냄 · 고객 확인 기다림",
  fixing: "남은 일이 있대요",
};

/** 기한 "11.4(수) 18:00" (API 시각 그대로, 서울) */
export const stampOf = (iso: string) => stampSeoul(new Date(iso));

/** 받은 날 "11.02(월)" */
export const dayOf = (iso: string) => md(dateSeoul(iso));

/** "32평" (평은 API가 표준견적서에 저장한 값) */
export const pyeongText = (p: string | null) => (p ? `${decText(p)}평` : "—");

/** "도배 기본형" · "목공" */
export function workText(v: Pick<Row, "trade" | "grade">): string {
  return v.trade === "dobae" && v.grade ? `${tradeLabel(v.trade)} ${gradeLabel(v.grade)}` : tradeLabel(v.trade);
}

/** 고객 이름 또는 요청 번호 (확인 창 · 화면 읽기 이름) */
export const whoOf = (v: Pick<Row, "customer" | "code">) => v.customer?.name ?? v.code;

/** 전화 걸기 주소 "tel:01023456789" */
export const telHref = (phone: string) => `tel:${phone.replace(/\D/g, "")}`;

/** 받침에 맞춰 이/가를 붙인다: "마루와벽" → "마루와벽이", "도배나라" → "도배나라가". 숫자로 끝나면 읽는 소리로 본다 */
export function iGa(word: string): string {
  const last = word.slice(-1);
  if (/[0-9]/.test(last)) return `${word}${"2459".includes(last) ? "가" : "이"}`; // 이 · 사 · 오 · 구는 받침이 없다
  const c = word.charCodeAt(word.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return `${word}이(가)`;
  return `${word}${(c - 0xac00) % 28 === 0 ? "가" : "이"}`;
}
