import { redirect } from "next/navigation";
import { VendorSignupForm, type Again } from "@/components/auth/VendorSignupForm";
import { ProHeader } from "@/components/pro/Shell";
import { AppHeader } from "@/components/site/AppHeader";
import { getMyApplication, listRegions, vendorGate } from "@/lib/api/vendor";
import { getSession } from "@/lib/session";

export const metadata = { title: "업체 가입 신청" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// 업체 가입 신청(V01 v_signup, C01 '업체로 가입'에서 와요). ?again=1: 거절된 업체가 로그인한 채 다시 신청(V22 '신청 정보 고치기', 지난 값을 채워요).
export default async function VendorSignupPage({ searchParams }: { searchParams: Promise<{ again?: string | string[] }> }) {
  const again = one((await searchParams).again) === "1";
  if (again) {
    const me = await vendorGate("/signup/vendor?again=1", "rejected");
    const app = await getMyApplication("rejected");
    if (!app || app.status !== "rejected") redirect("/vendor"); // 다시 신청은 거절된 신청만
    const data: Again = {
      email: me.email,
      prev: {
        biz_name: app.biz_name ?? "", owner_name: app.owner_name ?? "", phone: app.phone ?? "", biz_no: app.biz_no ?? "",
        trades: app.trades, areas: app.areas.map((a) => ({ sido: a.sido, sgg: a.sgg })),
        license: app.license ? { filename: app.license.filename, size: app.license.size, content_type: app.license.content_type } : null,
      },
    };
    const regions = await listRegions();
    return (
      <>
        <ProHeader me={me} phone={{ title: "업체 가입 신청", back: "/vendor" }} />
        <VendorSignupForm regions={regions} again={data} />
      </>
    );
  }
  if ((await getSession())?.role === "vendor") redirect("/vendor"); // 이미 업체 회원이면 업체 홈에서 심사 상태를 봐요
  const regions = await listRegions();
  return (
    <>
      <AppHeader phone={{ title: "업체 가입 신청", back: "/" }} />
      <VendorSignupForm regions={regions} />
    </>
  );
}
