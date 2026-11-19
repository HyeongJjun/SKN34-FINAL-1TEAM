// 공사(공사 날짜 · 추가 금액 · 공사 끝 · 리뷰) 화면 말. 날짜 · 금액은 API 값을 모양만 바꿔요(lib/format).
import type { ApiSchedule } from "@/lib/api/schedule";
import { dateLong } from "@/lib/format";

export type TradeDatesV3 = ApiSchedule["trades"][number];
export type ExtraItem = TradeDatesV3["extras"]["items"][number];
export type ScheduleView = "dates" | "extra" | "done";

/** 날을 하나씩: '1월 4일(월) · 5일(화)'(같은 달이면 뒤 날은 달을 빼요, C35) */
export function daysText(days: string[]): string {
  return days
    .map((d, i) => {
      const t = dateLong(d);
      return i > 0 && days[i - 1].slice(0, 7) === d.slice(0, 7) ? t.replace(/^\d+월 /, "") : t;
    })
    .join(" · ");
}

/** 지금 볼 추가 금액: 답을 기다리는 최신 판, 없으면 가장 최근 판 */
export function currentExtra(t: TradeDatesV3): ExtraItem | null {
  const live = t.extras.items.filter((x) => !x.superseded);
  return live.find((x) => x.answer === "pending") ?? live[live.length - 1] ?? null;
}

/** ?view=가 없을 때 가장 급한 것: 공사 끝 확인 > 추가 금액 답 > 공사 날짜 */
export function defaultView(t: TradeDatesV3 | null): ScheduleView {
  if (!t) return "dates";
  if (t.deal.status === "checking" || t.deal.status === "fixing" || t.deal.status === "done") return "done";
  if (t.extras.items.some((x) => !x.superseded && x.answer === "pending")) return "extra";
  return "dates";
}

export const VIEW_TITLE: Record<ScheduleView, string> = { dates: "공사 날짜", extra: "추가 금액", done: "공사 끝 확인" };

/** 다른 날짜 요청 이유(C52) */
export const DATE_REASONS = ["이사 날짜가 바뀌었어요", "그 주는 집을 비우기 어려워요", "그 밖"] as const;


/** 추가 금액 사진(고객, 같은 주소 API) */
/** 공사 끝 사진(C38, GET /projects/{id}/deals/{did}/photos/{file_id}) */
export const donePhotoHref = (projectId: string, dealId: string, fileId: string) =>
  `/api/projects/${encodeURIComponent(projectId)}/deals/${encodeURIComponent(dealId)}/photos/${encodeURIComponent(fileId)}`;
export const extraPhotoHref = (projectId: string, dealId: string, extraId: string, fileId: string) =>
  `/api/projects/${encodeURIComponent(projectId)}/deals/${encodeURIComponent(dealId)}/extras/${encodeURIComponent(extraId)}/files/${encodeURIComponent(fileId)}`;
