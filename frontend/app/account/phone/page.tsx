// /account/phone — 휴대폰 번호(C51). 고객만(업체는 회원정보에 휴대폰 줄이 없어요). 저장하면 내 정보로 돌아가요.
import { AppHeader } from "@/components/site/AppHeader";
import { PageHead } from "@/components/site/Frame";
import { PhoneForm } from "@/components/my/PhoneForm";
import { requireRoleV3b as requireRole } from "@/lib/mock/v3b/session";

export const metadata = { title: "휴대폰 번호" };

export default async function PhonePage() {
  const me = await requireRole("customer", "/account/phone");
  return (
    <>
      <AppHeader phone={{ title: "휴대폰 번호", back: "/account" }} />
      <PhoneForm
        phone={me.phone}
        top={<PageHead title="휴대폰 번호" crumbs={[{ label: "내 정보", href: "/account" }, { label: "휴대폰 번호" }]} />}
      />
    </>
  );
}
