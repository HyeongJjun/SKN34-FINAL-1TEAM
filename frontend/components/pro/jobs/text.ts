// 공사 날짜 내기(시안 WVCalendar)에만 쓰는 화면 말 · 표시 함수. 날짜 · 기간 · 기한은 API 값 그대로 형식만 바꾼다.
// 작업함 공사 탭 · 요청 자세히도 같은 말을 쓴다.
import type { Schemas } from "@/lib/backend/client";
import { md, stampSeoul } from "@/lib/format";

export type Job = Schemas["JobOut"];
export type Preview = Schemas["PreviewOut"];
export type Other = Schemas["OtherTradeOut"];
export type Method = Schemas["DatesIn"]["method"];
type JobRow = Pick<Schemas["InboxRowOut"], "dates_state" | "dates_due_at" | "overdue" | "start_date" | "end_date" | "proposed_start" | "proposed_end" | "request_due_at" | "wish_dates">;

/** 하루 작업 인원 한도 (schedule.models CREW_MAX와 같다) */
export const CREW_MAX = 20;

/** 날짜 바꾸는 이유 길이 한도 (schedule.schemas Reason과 같다) */
export const REASON_MAX = 300;

/** 고객이 수락하기 전: 날짜를 내고 다시 낼 수 있다 */
export const isOpen = (st: string | null | undefined) => st === "waiting" || st === "proposed" || st === "requested";

/** 고객이 수락한 뒤: 수락한 날짜를 바꾸는 중이거나 바꿀 수 있다 */
export const isAfter = (st: string | null | undefined) => st === "scheduled" || st === "change_requested" || st === "change_proposed";

/** 수락한 날짜를 스스로 바꿀 수 있다 (공사 끝냈어요 전, 확정 status = scheduled) */
export const canMove = (st: string | null | undefined, status: string | null | undefined) => st === "scheduled" && status === "scheduled";

/** 다시 고른 공사 (서버가 409 invalid_state로 주는 문장과 같다) */
export const RESELECTED = "고객이 업체를 다시 고르기로 했어요.";

/** 공사 날짜 화면으로 가는 버튼 말 (수락한 뒤 바꿀 수 있으면 '공사 날짜 바꾸기', 그 밖은 '공사 날짜 보기') */
export function goLabel(st: string | null | undefined, status?: string | null): string {
  if (st === "waiting") return "공사 날짜 내기";
  if (st === "proposed") return "날짜 다시 내기";
  if (st === "requested") return "요청에 답하기";
  if (st === "change_requested") return "새 날짜 올리기";
  if (canMove(st, status)) return "공사 날짜 바꾸기";
  return "공사 날짜 보기";
}

/** 공사 날짜 화면 주소. '공사 날짜 바꾸기'로 가면 바꾸기 칸을 펼쳐 둔다 (?change=1) */
export const jobHref = (dealId: string, st: string | null | undefined, status?: string | null) =>
  `/vendor/jobs/${dealId}${canMove(st, status) ? "?change=1" : ""}`;

// ---- 공사 끝냈어요 (시안 WVCalendar '공사 끝냈어요') ----

/** '공사 끝냈어요' · '남은 일 다 했어요'를 올릴 수 있는 확정 상태 (schedule.service FINISHABLE과 같다). 마지막 공사일부터인지는 API can_finish */
export const isFinishable = (status: string | null | undefined) => status === "scheduled" || status === "fixing";

/** 끝냄 버튼 말: 남은 일이면 '남은 일 다 했어요' */
export const finishLabel = (status: string | null | undefined) => (status === "fixing" ? "남은 일 다 했어요" : "공사 끝냈어요");

/** 공사 날짜 화면의 '공사 끝냈어요' 칸 */
export const finishHref = (dealId: string) => `/vendor/jobs/${dealId}#j-finish`;

/** 바로 해야 할 일이면 주 버튼 (날짜 내기 · 요청에 답하기 · 바꾸기 요청에 새 날짜 올리기) */
export const needsAct = (st: string | null | undefined) => st === "waiting" || st === "requested" || st === "change_requested";

export const METHOD_LABEL: Record<Method, string> = { app: "믿집에서 날짜 내기", call: "고객과 통화로 정함" };

/** "11.25(수) ~ 11.27(금)" (하루면 "11.25(수)") */
export const span = (a: string, b: string) => (a === b ? md(a) : `${md(a)} ~ ${md(b)}`);

/** 기한 "11.6(금) 18:00" (API 시각 그대로, 서울) */
export const stamp = (iso: string) => stampSeoul(new Date(iso));

/** 고객에게 보이는 정한 방법: "통화로 정함 · 11.3(화) 통화" · "믿집에서 냄" */
export function methodText(method: string, callOn: string | null | undefined): string {
  if (method === "call") return callOn ? `통화로 정함 · ${md(callOn)} 통화` : "통화로 정함";
  return "믿집에서 냄";
}

// ---- 공사 중 추가 금액 (시안 WVCalendar '추가 금액 알리기') ----

export type Extras = Schemas["TradeExtrasOut"];
export type Extra = Schemas["ExtraOut"];
export type ExtraVat = Schemas["ExtraIn"]["vat_mode"];

/** 추가 금액을 알릴 수 있는 확정 상태: 공사 날짜를 수락한 뒤 · 남은 일을 하는 동안 (schedule.service EXTRA_OPEN과 같다) */
export const canAddExtra = (status: string | null | undefined) => status === "scheduled" || status === "fixing";

/** 한 일 · 이유 길이, 사진 수 한도 (schedule.schemas ExtraIn · models EXTRA_PHOTOS_MAX와 같다) */
export const EXTRA_TITLE_MAX = 40;
export const EXTRA_PHOTOS_MAX = 5;

/** 공사 사진 (files.service RULES work_photo: JPG · PNG · WebP · HEIC, 10MB. HEIC는 서버가 JPG로 바꾼다) */
export const EXTRA_PHOTO = { accept: ".jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic", ext: /\.(jpe?g|png|webp|heic|heif)$/i, mb: 10 };

/** 과세 업체가 고르는 부가세 방식 (기본 부가세 빼고). 면세 업체는 면세만 */
export const EXTRA_VATS: ExtraVat[] = ["excluded", "included", "exempt"];

/** 적은 금액 칸 안내 (계산하지 않고 방식만 말한다) */
export const EXTRA_VAT_HINT: Record<ExtraVat, string> = {
  excluded: "부가세 빼고 적어요. 믿집이 10%를 더해 고객에게 보여 줘요.",
  included: "부가세를 넣은 금액이에요. 고객에게 이 금액 그대로 보여요.",
  exempt: "면세라 적은 금액 그대로 고객에게 보여요.",
};

/** 업체가 보는 고객 답 */
export const VENDOR_ACK: Record<Extra["ack"], string> = { pending: "확인 기다림", ok: "확인함", talk: "이야기하고 싶어 함" };

/** 고객에게 보이는 금액 꼬리: 면세면 "면세", 아니면 "부가세 포함" */
export const extraTail = (vatMode: string) => (vatMode === "exempt" ? "면세" : "부가세 포함");

/** 받침에 맞춰 은/는: "도배는", "목공은" */
export function eunNeun(word: string): string {
  const c = word.charCodeAt(word.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return `${word}은(는)`;
  return `${word}${(c - 0xac00) % 28 === 0 ? "는" : "은"}`;
}

/** 작업함 · 요청 자세히의 공사 날짜 한 줄 (기한 · 날짜는 API 값) */
export function datesLine(r: JobRow): string {
  const st = r.dates_state;
  if (st === "waiting") {
    if (!r.dates_due_at) return "공사 날짜를 내 주세요.";
    return r.overdue
      ? `공사 날짜를 낼 기한(${stamp(r.dates_due_at)})이 지났어요. 날짜를 내 주세요.`
      : `공사 날짜를 ${stamp(r.dates_due_at)}까지 내 주세요.`;
  }
  if (st === "proposed") {
    const when = r.proposed_start && r.proposed_end ? `낸 날짜 ${span(r.proposed_start, r.proposed_end)} · ` : "";
    return `${when}고객 수락을 기다려요. 수락하기 전까지 다시 낼 수 있어요.`;
  }
  if (st === "requested") {
    if (!r.request_due_at) return "고객이 다른 공사 날짜를 원해요.";
    return r.overdue
      ? `고객이 다른 공사 날짜를 원해요. 답할 기한(${stamp(r.request_due_at)})이 지났어요.`
      : `고객이 다른 공사 날짜를 원해요. ${stamp(r.request_due_at)}까지 답해 주세요.`;
  }
  if (st === "change_requested") {
    const wish = r.wish_dates.length ? ` 고객이 고른 시작일 ${r.wish_dates.map(md).join(" · ")}.` : "";
    if (!r.request_due_at) return `고객이 공사 날짜 바꾸기를 요청했어요.${wish}`;
    return r.overdue
      ? `고객이 공사 날짜 바꾸기를 요청했어요.${wish} 새 날짜를 올릴 기한(${stamp(r.request_due_at)})이 지났어요.`
      : `고객이 공사 날짜 바꾸기를 요청했어요.${wish} ${stamp(r.request_due_at)}까지 새 날짜를 올려 주세요.`;
  }
  if (st === "change_proposed") {
    const next = r.proposed_start && r.proposed_end ? ` · ${span(r.proposed_start, r.proposed_end)}` : "";
    const now = r.start_date && r.end_date ? ` 고객이 수락하기 전까지 ${span(r.start_date, r.end_date)} 그대로예요.` : "";
    return `새 날짜 수락 기다림${next}.${now}`;
  }
  if (st === "closed") return RESELECTED;
  return r.start_date && r.end_date ? `공사 날짜 확정 ${span(r.start_date, r.end_date)}` : "공사 날짜가 확정됐어요.";
}
