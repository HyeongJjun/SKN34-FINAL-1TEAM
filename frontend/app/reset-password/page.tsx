// 메일 발송 · 토큰 검증이 구현되기 전에는 준비 중 안내만 보여 준다.
import { SiteHeader } from "@/components/site/SiteHeader";
import { ResetPassword } from "@/components/auth/ResetPassword";
import s from "@/components/auth/auth.module.css";

export const metadata = { title: "비밀번호 찾기" };

export default function ResetPasswordPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className={`mj-wrap ${s.page}`}>
        <ResetPassword />
      </main>
    </>
  );
}
