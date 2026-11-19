import { redirect } from "next/navigation";
import { FirstDay } from "@/components/pro/home/FirstDay";
import { BasicForm } from "@/components/pro/profile/BasicForm";
import { CasesForm } from "@/components/pro/profile/CasesForm";
import { LinksForm } from "@/components/pro/profile/LinksForm";
import { ProfileTabs, type ProfileTab } from "@/components/pro/profile/ProfileTabs";
import { ProHeader, ProTabBar } from "@/components/pro/Shell";
import { Main } from "@/components/site/Frame";
import { approvedVendorGate, getMyProfile, getReviewLinks, getSetupDone, getVendorReviews, listRegions } from "@/lib/api/vendor";

export const metadata = { title: "업체 정보" };

const TABS: ProfileTab[] = ["basic", "cases", "links"];
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// 업체 정보 탭(폰 아래 탭 '업체 정보'). 9판: 탭을 누르면 V02(단가 · 업체 정보 · 링크 · 리뷰로 가는 첫 화면)이고,
// ?tab=basic(V15) · cases(V16) · links(V18)는 그 아래 화면이에요(‹ 가 이 첫 화면으로 와요). 승인된 업체만.
export default async function VendorProfilePage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const me = await approvedVendorGate("/vendor/profile");
  const want = one((await searchParams).tab);
  const tab = TABS.find((t) => t === want);
  if (!tab) {
    const [done, reviews] = await Promise.all([getSetupDone(), getVendorReviews("waiting").catch(() => null)]);
    return (
      <>
        <ProHeader me={me} />
        <Main narrow><FirstDay done={done} waiting={reviews?.waiting} /></Main>
        <ProTabBar />
      </>
    );
  }
  const profile = await getMyProfile();
  if (!profile) redirect("/vendor");
  const tabs = <ProfileTabs current={tab} cases={profile.portfolio.length} />;
  const header = <ProHeader me={me} phone={{ title: "업체 정보", back: "/vendor/profile" }} />;
  if (tab === "cases") return <>{header}<CasesForm profile={profile} tabs={tabs} /></>;
  if (tab === "links") {
    const links = await getReviewLinks();
    return <>{header}<LinksForm profile={profile} links={links} tabs={tabs} /></>;
  }
  const regions = await listRegions();
  return <>{header}<BasicForm profile={profile} regions={regions} tabs={tabs} /></>;
}
