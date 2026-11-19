// /reset-password — 비밀번호 찾기(C46). 메일은 아직 보내지 않아요(팀 확인 12): 눌러도 '보냈어요'라고 하지 않아요.
import { AppHeader } from "@/components/site/AppHeader";
import { Main, PageHead } from "@/components/site/Frame";
import { ResetPassword } from "@/components/auth/ResetPassword";
import s from "@/components/auth/card.module.css";

export const metadata = { title: "비밀번호 찾기" };

export default function ResetPasswordPage() {
  return (
    <>
      <AppHeader phone={{ title: "비밀번호 찾기", back: "/login" }} />
      <Main narrow>
        <div className={s.card}><PageHead title="비밀번호 찾기" /></div>
        <ResetPassword />
      </Main>
    </>
  );
}
