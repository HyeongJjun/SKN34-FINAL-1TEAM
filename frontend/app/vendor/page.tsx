import { SiteHeader } from "@/components/site/SiteHeader";
import { ApplicationHome } from "@/components/pro/home/ApplicationHome";
import { FirstDay } from "@/components/pro/home/FirstDay";
import { Inbox } from "@/components/pro/inbox/Inbox";
import { TABS, workText } from "@/components/pro/inbox/text";
import { getMyApplication, getMyPrices, getMyProfile } from "@/lib/api/vendor";
import { getInboxSummary, getVendorVisit, listInbox } from "@/lib/api/visit";
import { requireRole } from "@/lib/session";

export const metadata = { title: "업체 홈" };

const TRADES = ["dobae", "mokgong"] as const;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

type Search = { tab?: string | string[]; declined?: string | string[] };

// 업체 홈. 승인 전이면 가입 심사(시안 WVHome), 승인됐으면 작업함(시안 WVInbox).
// 받은 요청이 하나도 없으면(할 일 · 기다림 · 공사 · 끝남 모두 0) 승인 첫날 모습(WVFirst)이다.
// ?tab= 작업함 탭, ?declined= 방금 받지 않은 요청(맨 위 한 줄).
export default async function VendorHome({ searchParams }: { searchParams: Promise<Search> }) {
  await requireRole("vendor", "/vendor");
  const app = await getMyApplication();
  if (!app) {
    return (
      <>
        <SiteHeader />
        <main id="main" className="mj-wrap mj-main">
          <h1 className="mj-h1">업체 홈</h1>
          <p className="mj-sub">업체 신청을 찾을 수 없어요. 다시 로그인해 주세요.</p>
        </main>
      </>
    );
  }
  if (app.status !== "approved") {
    return (
      <>
        <SiteHeader />
        <ApplicationHome app={app} />
      </>
    );
  }
  const sp = await searchParams;
  const tab = TABS.find((t) => t.k === one(sp.tab))?.k ?? "todo";
  const declined = one(sp.declined);
  const mine = TRADES.filter((t) => app.trades.includes(t));
  const [prices, profile, summary, page, gone] = await Promise.all([
    Promise.all(mine.map((t) => getMyPrices(t).catch(() => null))),
    getMyProfile().catch(() => null),
    getInboxSummary(),
    listInbox(tab),
    declined ? getVendorVisit(declined) : null,
  ]);

  if (summary && summary.todo + summary.waiting + summary.jobs + summary.done > 0) {
    const note = gone?.status === "declined" ? `${gone.code} ${workText(gone)} 요청을 받지 않았어요. 고객에게 고른 이유가 보이고, 이 요청은 끝남 탭으로 옮겼어요.` : null;
    return (
      <>
        <SiteHeader />
        <Inbox
          tab={tab}
          summary={summary}
          page={page}
          prices={mine.map((t, i) => ({ trade: t, p: prices[i] }))}
          profile={profile}
          fallback={{ owner: app.owner_name, phone: app.phone, biz: app.biz_name }}
          note={note}
        />
      </>
    );
  }

  // 처음 할 일을 마쳤는지는 지금 있는 읽기로만 본다:
  // 견적서 = 공정 중 하나라도 확인한 단가 묶음이 있음, 실측 방식 = 연락 방식을 정함,
  // 활동 지역 = 업체 정보를 한 번이라도 저장함(저장할 때 활동 지역도 함께 낸다).
  const done = {
    prices: prices.some((p) => !!p?.confirmed),
    visit: !!profile?.contact_method,
    area: !!profile?.updated_at,
  };
  return (
    <>
      <SiteHeader />
      <FirstDay app={app} done={done} />
    </>
  );
}
