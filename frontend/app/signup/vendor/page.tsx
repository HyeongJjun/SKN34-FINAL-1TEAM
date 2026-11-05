import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site/SiteHeader";
import { VendorSignupForm, type Again } from "@/components/auth/VendorSignupForm";
import { listRegions } from "@/lib/api/project";
import { getMyApplication } from "@/lib/api/vendor";
import { getSession, requireRole } from "@/lib/session";
import s from "./page.module.css";

export const metadata = { title: "업체 가입 신청" };

// 업체 가입 신청 (시안 WVSignup). ?again=1: 거절된 업체가 로그인한 채 다시 신청(지난 값을 채운다).
export default async function VendorSignupPage({ searchParams }: { searchParams: Promise<{ again?: string }> }) {
  const { again } = await searchParams;
  let data: Again | undefined;
  if (again === "1") {
    const me = await requireRole("vendor", "/signup/vendor?again=1");
    const app = await getMyApplication();
    if (!app || app.status !== "rejected") redirect("/vendor"); // 다시 신청은 거절된 신청만
    data = {
      email: me.email,
      appliedAt: app.applied_at,
      prev: {
        biz_name: app.biz_name ?? "", owner_name: app.owner_name ?? "", phone: app.phone ?? "", biz_no: app.biz_no ?? "",
        trades: app.trades, areas: app.areas.map((a) => ({ sido: a.sido, sgg: a.sgg })), fileName: app.license?.filename ?? null,
      },
    };
  } else if ((await getSession())?.role === "vendor") {
    redirect("/vendor"); // 이미 업체 회원이면 업체 홈에서 심사 상태를 본다
  }
  const regions = await listRegions();
  return (
    <>
      <SiteHeader />
      <main id="main">
        <div className={`mj-wrap ${s.top}`}>
          <div className={s.head}>
            <h1 className="mj-h1">{data ? "업체로 다시 신청해요" : "업체로 가입 신청해요"}</h1>
            {data ? <p className="mj-sub">지난 신청을 고쳐 다시 내면 관리자가 다시 확인해요.</p> : null}
          </div>
        </div>
        <div className="mj-wrap">
          <VendorSignupForm regions={regions} again={data} />
        </div>
      </main>
    </>
  );
}
