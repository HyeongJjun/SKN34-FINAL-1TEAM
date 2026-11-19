// /signup — 가입 고르기(C04) · ?step=email이면 이메일 가입 · 약관 동의(C05). 웹은 가운데 카드 460(W9: 가입 · 로그인만).
// 이미 로그인했으면 가입 화면을 보이지 않고 그 사람 첫 화면으로 보내요.
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/site/AppHeader";
import { Main, PageHead } from "@/components/site/Frame";
import { SignupChoice } from "@/components/auth/SignupChoice";
import { SignupForm } from "@/components/auth/SignupForm";
import { HOME, safeNext, withNext } from "@/components/auth/next";
import { MOCK_V3A } from "@/lib/mock/v3a/mode";
import { getSession } from "@/lib/session";
import s from "@/components/auth/card.module.css";

export const metadata = { title: "가입" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ step?: string; next?: string | string[] }> }) {
  const sp = await searchParams;
  const next = safeNext(Array.isArray(sp.next) ? sp.next[0] : sp.next) ?? undefined;
  const session = await getSession();
  if (session) redirect(next ?? HOME[session.role]);
  const email = sp.step === "email";
  return (
    <>
      <AppHeader phone={email ? { title: "이메일로 가입", back: withNext("/signup", next) } : { title: "가입", back: "/start/standard" }} />
      <Main narrow>
        {email ? (
          <>
            <div className={s.card}><PageHead title="이메일로 가입" /></div>
            <SignupForm next={next} mock={MOCK_V3A} />
          </>
        ) : (
          <SignupChoice next={next} />
        )}
      </Main>
    </>
  );
}
