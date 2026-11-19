// 업체 · 관리자 화면 머리 · 아래 탭 바. 실제 모드는 B4 껍데기(AppHeader · TabBar)를 그대로 쓰고,
// 예시 데이터 모드(세션 없이 화면을 볼 때)만 같은 모양 조각(HeaderBar · TabBarNav)에 예시 세션을 넘겨요.
import { AppHeader } from "@/components/site/AppHeader";
import { HeaderBar, type PhoneHeader } from "@/components/site/HeaderBar";
import { TABS } from "@/components/site/nav";
import { TabBar } from "@/components/site/TabBar";
import { TabBarNav } from "@/components/site/TabBarNav";
import { MOCK_UNREAD } from "@/lib/api/vendor";
import { MOCK } from "@/lib/mock/v3c/mode";
import type { Session } from "@/lib/types";

export function ProHeader({ me, phone, only }: { me: Session; phone?: PhoneHeader; only?: "web" | "phone" }) {
  if (!MOCK) return <AppHeader phone={phone} only={only} />;
  return <HeaderBar session={me} unread={MOCK_UNREAD} phone={phone} only={only} />;
}

/** 폰 아래 탭 바(작업함 · 채팅 · 업체 정보 · 알림). 아래 단추 띠가 있는 화면에는 두지 않아요 */
export function ProTabBar() {
  if (!MOCK) return <TabBar />;
  return <TabBarNav tabs={TABS.vendor ?? []} counts={{ notify: MOCK_UNREAD }} role="vendor" />;
}

export function AdminHeader({ me }: { me: Session }) {
  if (!MOCK) return <AppHeader admin />;
  return <HeaderBar session={me} admin />;
}
