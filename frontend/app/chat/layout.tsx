import { AppHeader } from "@/components/site/AppHeader";
import { ChatShell } from "@/components/thread/ChatShell";
import { listThreadsOnce } from "@/lib/api/thread";
import { todaySeoul } from "@/lib/format";
import { requireRoleV3b as requireRole } from "@/lib/mock/v3b/session";

export const metadata = { title: "채팅" };

// 고객-업체 채팅(C23~C31 · D05 · V09 · V19 · V20). 고객 · 업체가 같이 쓰고 역할로 모양만 나눠요.
// 웹(≥1024)은 [목록 | 대화] 2단(이 레이아웃이 목록을 그려요), 폰 · 태블릿은 목록 화면(/chat)과 대화 화면(/chat/{id})이 따로예요.
// 웹 머리는 여기서, 폰 머리는 화면마다 그려요(ui-components 1장).
export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  await requireRole(["customer", "vendor"], "/chat");
  const threads = await listThreadsOnce();
  return (
    <>
      <AppHeader only="web" />
      <ChatShell threads={threads} today={todaySeoul()}>{children}</ChatShell>
    </>
  );
}
