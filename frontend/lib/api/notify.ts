// 서버 쪽 읽기: 화면 알림. 알림 목록과 머리 종 · 탭 바의 안 읽은 수.
// 예시 데이터(NEXT_PUBLIC_MJ_MOCK=1, 개발에서만)면 9판 이야기 알림(lib/mock/v3b)을 읽어요.
import { hasSessionCookie, serverGet, type Schemas } from "@/lib/backend/server";
import { MOCK_V3B } from "@/lib/mock/v3b/mode";
import { mockProjectIds, mockRole, mockStep } from "@/lib/mock/v3b/server";
import { mockNotifications } from "@/lib/mock/v3b/story";

export type Notice = Schemas["NotificationOut"];
export type NoticePage = Schemas["NotificationPage"];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isProjectId = (v: string) => UUID.test(v);

async function mockPage(): Promise<NoticePage> {
  const [step, role, ids] = await Promise.all([mockStep(), mockRole(), mockProjectIds()]);
  return mockNotifications(step, role, ids[0] ?? "");
}

/** 내 알림(최근 것부터 50개). projectId를 주면 그 공사 소식만. */
export async function listNotifications(projectId?: string): Promise<NoticePage> {
  if (MOCK_V3B) {
    const page = await mockPage();
    return projectId ? { ...page, items: page.items.filter((n) => n.project_id === projectId) } : page;
  }
  const q = projectId && UUID.test(projectId) ? `?project_id=${encodeURIComponent(projectId)}` : "";
  return (await serverGet<NoticePage>(`/notifications${q}`)) ?? { items: [], unread: 0 };
}

/** 머리 종의 안 읽은 수. 로그인 안 했거나 읽지 못하면 0 */
export async function getUnread(): Promise<number> {
  if (!(await hasSessionCookie())) return 0;
  try {
    if (MOCK_V3B) return (await mockPage()).unread;
    const r = await serverGet<{ unread?: unknown }>("/notifications/unread");
    return typeof r?.unread === "number" && r.unread > 0 ? r.unread : 0;
  } catch {
    return 0;
  }
}
