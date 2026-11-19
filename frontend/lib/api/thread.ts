// 서버 쪽 읽기: 고객-업체 채팅(thread, api.md 7장). 고객 · 업체가 같은 길을 써요(응답 모양만 역할로 달라요).
// 실시간은 lib/backend/stream.ts(GET /stream), 보내기 · 읽음은 브라우저가 POST(/threads/{tid}/messages · read)로 해요.
// 예시 데이터(NEXT_PUBLIC_MJ_MOCK=1, 개발에서만)면 9판 이야기 대화(lib/mock/v3b)를 읽어요.
import { cache } from "react";
import { serverGet, type Schemas } from "@/lib/backend/server";
import { MOCK_V3B } from "@/lib/mock/v3b/mode";
import { mockProjectIds, mockRole, mockStep } from "@/lib/mock/v3b/server";
import { mockMessages, mockPick, mockThread, mockThreads } from "@/lib/mock/v3b/story";
import { getVendorVisit, getVisitPick } from "./visit";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const seg = encodeURIComponent;
export const isThreadId = (v: string) => UUID.test(v);

export type ThreadRow = Schemas["ThreadRowOut"];
export type Thread = Schemas["ThreadOut"];
export type Message = Schemas["MessageOut"];

/** 내 대화 목록(최근 순, C24 · V19) */
export async function listThreads(): Promise<ThreadRow[]> {
  if (MOCK_V3B) return mockThreads(await mockStep(), await mockRole());
  return (await serverGet<ThreadRow[]>("/threads")) ?? [];
}

/** 한 요청 안에서는 한 번만 읽어요(채팅 레이아웃의 목록과 화면이 같이 써요) */
export const listThreadsOnce = cache(listThreads);

/** 빈 채팅 화면(C23)의 '실측 일정 보기'가 갈 공사: 가장 최근에 소식이 있는 내 공사 */
export async function latestProjectId(): Promise<string | null> {
  if (MOCK_V3B) return (await mockProjectIds())[0] ?? null;
  const list = await serverGet<{ id: string; updated_at?: string }[]>("/projects").catch(() => null);
  if (!list?.length) return null;
  const at = (v?: string) => Date.parse(v ?? "") || 0;
  return [...list].sort((a, b) => at(b.updated_at) - at(a.updated_at))[0].id;
}

/** 대화 머리(상대 이름표 · 공사 요약 · 실측 · 단추 · 링크). 남의 대화면 null */
export async function getThread(threadId: string): Promise<Thread | null> {
  if (!UUID.test(threadId)) return null;
  if (MOCK_V3B) {
    const [step, role, ids] = await Promise.all([mockStep(), mockRole(), mockProjectIds()]);
    return mockThread(step, threadId, role, ids[0] ?? "");
  }
  return serverGet<Thread>(`/threads/${seg(threadId)}`);
}

/** 대화 글(seq 순). 처음은 최근 limit개, after_seq로 빠진 것을 채우고 before_seq로 앞 글을 더 읽어요 */
export async function listMessages(threadId: string, opts: { afterSeq?: number; beforeSeq?: number; limit?: number } = {}): Promise<Message[] | null> {
  if (!UUID.test(threadId)) return null;
  if (MOCK_V3B) return mockMessages(await mockStep(), threadId, await mockRole(), opts.afterSeq);
  const qs = new URLSearchParams();
  if (opts.afterSeq != null) qs.set("after_seq", String(opts.afterSeq));
  if (opts.beforeSeq != null) qs.set("before_seq", String(opts.beforeSeq));
  qs.set("limit", String(opts.limit ?? 50));
  return serverGet<Message[]>(`/threads/${seg(threadId)}/messages?${qs.toString()}`);
}

/** 채팅 위 띠 · 일정 바꾸기 카드에 쓰는 실측 정보(thread는 visit을 몰라서 화면이 visit API로 따로 읽어요, architecture 3장).
 *  고객은 GET /projects/{pid}/visits/{vid}, 업체는 GET /vendor/visits/{vid}. 못 읽으면 null(띠는 목록의 visit_label로 대신해요) */
export type ThreadVisit = {
  visitId: string;
  status: string;
  booked: { day: string; half: "am" | "pm" } | null;
  change: Schemas["ChangeOut"] | null;
  /** 고객 일정 바꾸기 시트: 업체 가능 날 · 반나절 · 마감 */
  days: Schemas["DayHalvesOut"][];
  full: Schemas["SlotOut"][];
  /** 업체 화면 띠: '노원구 상계동 69.4㎡' */
  areaLabel: string | null;
};
export async function getThreadVisit(t: Thread, role: "customer" | "vendor"): Promise<ThreadVisit | null> {
  if (!t.visit_id || !UUID.test(t.visit_id)) return null;
  if (MOCK_V3B) {
    const [step, ids] = await Promise.all([mockStep(), mockProjectIds()]);
    const p = mockPick(step, t.project_id ?? ids[0] ?? "", t.visit_id);
    if (!p) return null;
    return { visitId: p.visit_id, status: p.status, booked: p.booked ? { day: p.booked.day, half: p.booked.half } : null, change: p.change, days: role === "customer" ? p.days : [], full: role === "customer" ? p.full : [], areaLabel: t.area_label };
  }
  if (role === "customer") {
    if (!t.project_id) return null;
    const p = await getVisitPick(t.project_id, t.visit_id).catch(() => null);
    if (!p) return null;
    return { visitId: p.visit_id, status: p.status, booked: p.booked ? { day: p.booked.day, half: p.booked.half } : null, change: p.change, days: p.days, full: p.full, areaLabel: null };
  }
  const v = await getVendorVisit(t.visit_id).catch(() => null);
  if (!v) return null;
  return { visitId: v.id, status: v.status, booked: v.booked ? { day: v.booked.day, half: v.booked.half } : null, change: v.change ?? null, days: [], full: [], areaLabel: v.area_label ?? t.area_label };
}
