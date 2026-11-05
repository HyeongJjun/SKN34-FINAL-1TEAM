// 404 · 찾는 화면이 없어요. 없는 주소, 지운 것, 남의 공사 · 견적서도 '없다'고만 답한다(있는지조차 알리지 않는다).
import Link from "next/link";
import { SiteHeader } from "@/components/site/SiteHeader";
import { StatusPage, homeAction } from "@/components/site/StatusPage";
import { getSession } from "@/lib/session";

export const metadata = { title: "찾는 화면이 없어요" };

export default async function NotFound() {
  const home = homeAction(await getSession());
  return (
    <>
      <SiteHeader />
      <StatusPage
        code="404"
        title="찾는 화면이 없어요"
        actions={<><Link className="mj-btn mj-btn-pri" href={home.href}>{home.label}</Link><Link className="mj-btn mj-btn-sec" href="/">첫 화면으로</Link></>}
      >
        <p className="mj-sub">주소가 틀렸거나, 지워졌거나, 지금 계정으로는 볼 수 없는 화면이에요. 주소창의 주소를 한 번 더 확인해 주세요.</p>
      </StatusPage>
    </>
  );
}
