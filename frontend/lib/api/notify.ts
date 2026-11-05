// 서버 쪽 읽기: 화면 알림. 알림 목록과 머리 종의 안 읽은 수.
import { hasSessionCookie, serverGet, type Schemas } from "@/lib/backend/server";

export type Notice = Schemas["NotificationOut"];
export type NoticePage = Schemas["NotificationPage"];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isProjectId = (v: string) => UUID.test(v);

/** 내 알림(최근 것부터 50개). projectId를 주면 그 공사 소식만. */
export async function listNotifications(projectId?: string): Promise<NoticePage> {
  const q = projectId && UUID.test(projectId) ? `?project_id=${projectId}` : "";
  return (await serverGet<NoticePage>(`/notifications${q}`)) ?? { items: [], unread: 0 };
}

/** 머리 종의 안 읽은 수. 로그인 안 했거나 읽지 못하면 0 */
export async function getUnread(): Promise<number> {
  if (!(await hasSessionCookie())) return 0;
  try {
    const r = await serverGet<{ unread?: unknown }>("/notifications/unread");
    return typeof r?.unread === "number" && r.unread > 0 ? r.unread : 0;
  } catch {
    return 0;
  }
}
