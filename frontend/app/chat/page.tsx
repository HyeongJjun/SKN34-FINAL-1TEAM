import { AppHeader } from "@/components/site/AppHeader";
import { TabBar } from "@/components/site/TabBar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ThreadList } from "@/components/thread/ThreadList";
import { latestProjectId, listThreadsOnce } from "@/lib/api/thread";
import { getVisitBoard } from "@/lib/api/visit";
import { todaySeoul } from "@/lib/format";
import { requireRoleV3b as requireRole } from "@/lib/mock/v3b/session";
import s from "@/components/thread/thread.module.css";

export const metadata = { title: "채팅" };

// 채팅 목록(C24 · V19) · 실측 확정 전 빈 화면(C23). 폰은 이 화면이 목록, 웹은 왼쪽 목록(레이아웃) + 오른쪽 안내 한 줄.
export default async function ChatListPage() {
  const me = await requireRole(["customer", "vendor"], "/chat");
  const threads = await listThreadsOnce();
  const today = todaySeoul();
  return (
    <>
      <AppHeader only="phone" phone={{ title: "채팅" }} />
      <main id="main" className={s.main}>
        <h1 className="mj-sr">채팅</h1>
        {threads.length ? (
          <>
            <div className={s.phoneList}><div className={s.listWrap}><ThreadList threads={threads} today={today} /></div></div>
            <p className={s.pick}>대화를 고르면 여기에 보여요</p>
          </>
        ) : me.role === "vendor" ? (
          <div className={s.empty}>
            <EmptyState icon="chat" title={<>실측이 확정되면<br />고객과 채팅할 수 있어요</>} action={<Button variant="text" arrow href="/vendor">작업함 보기</Button>} />
          </div>
        ) : (
          <CustomerEmpty />
        )}
      </main>
      <TabBar />
    </>
  );
}

/** C23: 날짜 고를 차례인 업체가 있으면 그 업체 이름으로 언제 열리는지 알려요 */
async function CustomerEmpty() {
  const pid = await latestProjectId();
  const board = pid ? await getVisitBoard(pid).catch(() => null) : null;
  const offered = board?.board.find((r) => r.status === "offered");
  return (
    <div className={s.empty}>
      <EmptyState
        icon="chat"
        title={<>실측 날짜가 정해지면<br />업체와 채팅할 수 있어요</>}
        action={pid ? <Button variant="text" arrow href={`/projects/${encodeURIComponent(pid)}/visits`}>실측 일정 보기</Button> : <Button variant="text" arrow href="/my">내 공사 보기</Button>}
      >
        {offered ? `${offered.vendor_name} 날짜를 고르면 바로 열려요` : "실측 날짜를 고르면 바로 열려요"}
      </EmptyState>
    </div>
  );
}
