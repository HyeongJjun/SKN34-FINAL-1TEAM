// 로그인(시안 WLogin). 카카오 로그인은 화면만 있고 연결은 나중 작업이다.
import { SiteHeader } from "@/components/site/SiteHeader";
import { LoginForm } from "@/components/auth/LoginForm";
import { DraftAside } from "@/components/auth/DraftAside";
import { AuthTabs, OrEmail, VendorJoin } from "@/components/auth/parts";
import { KakaoButton } from "@/components/auth/KakaoButton";
import s from "@/components/auth/auth.module.css";

export const metadata = { title: "로그인" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const raw = (await searchParams).next;
  const next = Array.isArray(raw) ? raw[0] : raw;
  return (
    <>
      <SiteHeader />
      <main id="main" className={`mj-wrap ${s.page}`}>
        <div className={s.cols}>
          <div className={s.col}>
            <h1 className="mj-sr">로그인</h1>
            <AuthTabs current="login" next={next} />
            <KakaoButton label="카카오로 로그인" soon="카카오 로그인은 준비 중이에요. 지금은 아래 이메일로 로그인해 주세요." />
            <OrEmail />
            <LoginForm next={next} />
            <VendorJoin />
          </div>
          <DraftAside action="로그인" />
        </div>
      </main>
    </>
  );
}
