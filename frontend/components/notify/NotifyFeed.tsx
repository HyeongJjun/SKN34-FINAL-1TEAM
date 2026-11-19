"use client";
// 알림 목록(C44 고객 · V21 업체): 새 알림(안 읽음) · 지난 알림. 줄을 누르면 읽음을 보내고 그 일로 가요(읽음이 실패해도 넘어가요).
// '모두 읽음'은 화면 제목 오른쪽 글자 단추예요(ReadAllAction).
// 읽음을 보낸 뒤 머리 종 · 탭 바 숫자를 바로 맞춰요(B4 LiveProvider setUnread, 줄기의 notif가 오면 그 값이 이겨요).
import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorText } from "@/lib/backend/client";
import { listStamp } from "@/lib/format";
import { send } from "@/lib/mock/v3b/client";
import { useLive } from "@/components/site/LiveProvider";
import { Button } from "@/components/ui/Button";
import { NotifyList, NotifyRow } from "@/components/ui/NotifyRow";
import { useToast } from "@/components/ui/Toast";

export type FeedItem = { id: string; body: string; link: string; at: string; read: boolean; sub?: string };

export function NotifyFeed({ items, unread }: { items: FeedItem[]; /** 서버가 준 안 읽은 수 */ unread: number }) {
  const [opened, setOpened] = useState<Set<string>>(() => new Set());
  const live = useLive();
  const open = (n: FeedItem) => {
    if (n.read || opened.has(n.id)) return;
    setOpened((xs) => new Set(xs).add(n.id));
    live.setUnread(Math.max(0, (live.unread ?? unread) - 1));
    // 예시 데이터면 보내지 않아요(읽음은 화면에만). 실패해도 그 일로는 넘어가요
    void send("POST", `/notifications/${encodeURIComponent(n.id)}/read`, {}, {}).catch(() => undefined);
  };
  const row = (n: FeedItem) => (
    <NotifyRow key={n.id} href={n.link} title={n.body} sub={n.sub} time={listStamp(n.at)} unread={!n.read && !opened.has(n.id)} onOpen={() => open(n)} />
  );
  return <NotifyList fresh={items.filter((n) => !n.read).map(row)} past={items.filter((n) => n.read).map(row)} />;
}

export function ReadAllAction() {
  const router = useRouter();
  const toast = useToast();
  const live = useLive();
  const [busy, setBusy] = useState(false);
  async function onClick() {
    if (busy) return;
    setBusy(true);
    try {
      await send("POST", "/notifications/read-all", {}, {}); // 예시 데이터에서는 보내는 척만 해요
      live.setUnread(0);
      toast.show("모두 읽음으로 바꿨어요");
      router.refresh();
    } catch (e) {
      toast.show(errorText(e), { tone: "error" });
    } finally {
      setBusy(false);
    }
  }
  return <Button variant="text" busy={busy} onClick={onClick}>{busy ? "바꾸는 중" : "모두 읽음"}</Button>;
}
