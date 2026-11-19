// /notifications — 알림(C44 고객 · V21 업체). 화면 알림만 써요(문자 · 메일 없음). 최근 것부터 50개.
// 고객은 줄마다 어느 공사 일인지 공사 이름을 붙여요. ?project= 를 주면 그 공사 소식만 봐요. 새 알림이 오면 다시 읽어요.
import { AppHeader } from "@/components/site/AppHeader";
import { Main, PageHead } from "@/components/site/Frame";
import { TabBar } from "@/components/site/TabBar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { NotifyFeed, ReadAllAction, type FeedItem } from "@/components/notify/NotifyFeed";
import { LiveRefresh } from "@/components/schedule/LiveRefresh";
import { isProjectId, listNotifications } from "@/lib/api/notify";
import { listMyProjectsV3 } from "@/lib/api/schedule";
import { projectName } from "@/lib/guest/info";
import { requireRoleV3b as requireRole } from "@/lib/mock/v3b/session";

export const metadata = { title: "알림" };

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ project?: string | string[] }> }) {
  const raw = (await searchParams).project;
  const pick = Array.isArray(raw) ? raw[0] : raw;
  const project = pick && isProjectId(pick) ? pick : undefined;
  const session = await requireRole(["customer", "vendor"], project ? `/notifications?project=${encodeURIComponent(project)}` : "/notifications");
  const customer = session.role === "customer";
  const [page, mine] = await Promise.all([listNotifications(project), customer ? listMyProjectsV3().catch(() => []) : Promise.resolve([])]);
  const names = new Map(mine.map((p) => [p.id, projectName(p.emd, p.region, p.trades)]));
  const items: FeedItem[] = page.items.map((n) => ({
    id: n.id, body: n.body, link: n.link, at: n.created_at, read: n.read,
    sub: n.project_id ? names.get(n.project_id) : undefined,
  }));
  const desc = project ? (names.get(project) ?? "이 공사 소식") : page.unread ? `안 읽은 알림 ${page.unread}개` : "안 읽은 알림이 없어요";

  return (
    <>
      <AppHeader phone={{ title: "알림" }} />
      <Main narrow>
        <PageHead title="알림" desc={desc} action={page.unread ? <ReadAllAction /> : undefined} />
        {items.length ? (
          <NotifyFeed items={items} unread={page.unread} />
        ) : (
          <EmptyState
            icon="bell"
            title={project ? "이 공사 소식이 아직 없어요" : "아직 알림이 없어요"}
            action={project ? <Button variant="text" arrow href="/notifications">전체 알림 보기</Button> : undefined}
          >
            새 알림이 오면 여기에 보여요
          </EmptyState>
        )}
        {project && items.length ? <Button variant="text" arrow href="/notifications">전체 알림 보기</Button> : null}
      </Main>
      <TabBar />
      <LiveRefresh notif />
    </>
  );
}
