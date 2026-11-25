// 업체 실측 영업일(2026-11-25 회의): 요일 · 쉬는 날을 미리 등록해요. 고객은 담은 업체의 이 영업일에서 실측 반나절을 골라요.
import { OpenDaysForm } from "@/components/pro/opendays/OpenDaysForm";
import { ProHeader, ProTabBar } from "@/components/pro/Shell";
import { Main, PageHead } from "@/components/site/Frame";
import { approvedVendorGate } from "@/lib/api/vendor";
import { serverGet, type Schemas } from "@/lib/backend/server";
import { todaySeoul } from "@/lib/format";

export const metadata = { title: "실측 영업일" };

export default async function VendorOpenDaysPage() {
  const me = await approvedVendorGate("/vendor/open-days");
  const days = await serverGet<Schemas["OpenDaysOut"]>("/vendor/open-days");
  return (
    <>
      <ProHeader me={me} phone={{ title: "실측 영업일", back: "/vendor" }} />
      <Main narrow>
        <PageHead title="실측 영업일" />
        <OpenDaysForm initial={days ?? { open_weekdays: [0, 1, 2, 3, 4, 5], off_days: [] }} today={todaySeoul()} />
      </Main>
      <ProTabBar />
    </>
  );
}
