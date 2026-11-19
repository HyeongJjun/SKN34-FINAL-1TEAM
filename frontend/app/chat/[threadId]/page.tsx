import { notFound } from "next/navigation";
import { AppHeader } from "@/components/site/AppHeader";
import { Avatar } from "@/components/project/Kit";
import { Conversation } from "@/components/thread/Conversation";
import { MoreMenu } from "@/components/thread/MoreMenu";
import { getThread, getThreadVisit, isThreadId, listMessages, listThreadsOnce } from "@/lib/api/thread";
import { todaySeoul } from "@/lib/format";
import { requireRoleV3b as requireRole } from "@/lib/mock/v3b/session";
import s from "@/components/thread/thread.module.css";

export const metadata = { title: "채팅" };

// 대화(C25 · C26 · C28 · C29 · C30 · C31 · C62 · D05 오른쪽 · V09 · V20). 남의 대화 · 없는 대화는 찾을 수 없음(404, C56).
// 고객 화면은 상대를 업체 상호로, 업체 화면은 '상계동 고객'(동네 + 고객)으로만 보여요(고객 이름 · 휴대폰은 업체 응답에 없어요).
export default async function ThreadPage({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params;
  const me = await requireRole(["customer", "vendor"], isThreadId(threadId) ? `/chat/${threadId}` : "/chat");
  const thread = await getThread(threadId);
  if (!thread) notFound();
  const role = me.role === "vendor" ? "vendor" : "customer";
  const [messages, visit, rows] = await Promise.all([listMessages(threadId), getThreadVisit(thread, role), listThreadsOnce()]);
  const row = rows.find((r) => r.thread_id === thread.thread_id);
  return (
    <>
      <AppHeader only="phone" phone={{ title: thread.title, back: "/chat", lead: <Avatar name={thread.title} small />, action: <MoreMenu thread={thread} visit={visit} role={role} /> }} />
      <main id="main" className={s.main}>
        <h1 className="mj-sr">{thread.title} 채팅</h1>
        <Conversation key={thread.thread_id} role={role} thread={thread} visit={visit} visitLabel={row?.visit_label ?? null} initial={messages ?? []} today={todaySeoul()} />
      </main>
    </>
  );
}
