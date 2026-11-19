// /login — 로그인(C06). 알림 · 메일 링크로 왔으면(?next=) '로그인하면 보던 화면 ○○로 이어 가요'를 보이고, 로그인 뒤 그 화면으로 가요.
// 로그인 전이라 업체 이름 · 공사 내용은 보이지 않고 화면 이름만 써요. 웹은 가운데 카드 460(W9).
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/site/AppHeader";
import { Main, PageHead } from "@/components/site/Frame";
import { LoginForm } from "@/components/auth/LoginForm";
import { HOME, nextScreen, safeNext } from "@/components/auth/next";
import { MOCK_V3A } from "@/lib/mock/v3a/mode";
import { getSession } from "@/lib/session";
import s from "@/components/auth/card.module.css";

export const metadata = { title: "로그인" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const raw = (await searchParams).next;
  const next = safeNext(Array.isArray(raw) ? raw[0] : raw) ?? undefined;
  const session = await getSession();
  if (session) redirect(next ?? HOME[session.role]);
  const screen = nextScreen(next);
  return (
    <>
      <AppHeader phone={{ title: "로그인", back: "/" }} />
      <Main narrow>
        <div className={s.card}>
          <PageHead title="로그인" />
          {next ? <p className={s.info}>{screen ? <>로그인하면 보던 화면 <b>{screen}</b> 이어 가요</> : "로그인하면 보던 화면으로 이어 가요"}</p> : null}
        </div>
        <LoginForm next={next} mock={MOCK_V3A} />
      </Main>
    </>
  );
}
