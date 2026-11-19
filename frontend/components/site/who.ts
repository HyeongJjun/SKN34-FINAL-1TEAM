// 머리 · 아래 탭 바가 같이 쓰는 '누가 · 안 읽은 알림 수'. 한 요청 안에서는 한 번만 읽어요(React cache).
import { cache } from "react";
import { getUnread } from "@/lib/api/notify";
import { getSession } from "@/lib/session";

export const getShellData = cache(async () => {
  const session = await getSession();
  const unread = session && session.role !== "admin" ? await getUnread() : 0;
  return { session, unread };
});
