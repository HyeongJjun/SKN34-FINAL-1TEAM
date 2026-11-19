"use client";
// 오류 화면(C56 덧그림 · CF-55): 화면을 그리다 난 오류만 이 화면으로 바꿔요(보내다 난 오류는 단추 아래 글로 알려요).
// 오류 경계는 브라우저 조각이라 서버 머리(AppHeader)를 못 써요. /me로 누구인지 읽어 같은 머리(HeaderBar)를 그려요.
import { useEffect, useState } from "react";
import { HeaderBar } from "@/components/site/HeaderBar";
import { Main } from "@/components/site/Frame";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { call, type Schemas } from "@/lib/backend/client";
import type { Role, Session } from "@/lib/types";

const ROLES: Role[] = ["customer", "vendor", "admin"];

function toSession(me: Schemas["MeOut"]): Session | null {
  if (!ROLES.includes(me.role as Role)) return null;
  return { id: me.id, email: me.email, name: me.name, role: me.role as Role, vendorStatus: me.vendor_status ?? null, vendorRejectReason: me.vendor_reject_reason ?? null, phone: me.phone ?? null, joinedAt: me.created_at };
}

export default function ErrorPage({ retry }: { error: unknown; retry: () => void }) {
  // undefined: 아직 모름(로고만), null: 로그인 안 함
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    document.getElementById("err-t")?.focus();
    let alive = true;
    call<Schemas["MeOut"]>("GET", "/me")
      .then((me) => { if (alive) setSession(toSession(me)); })
      .catch(() => { if (alive) setSession(null); });
    return () => { alive = false; };
  }, []);

  return (
    <>
      <title>문제가 생겼어요 · 믿집</title>
      <HeaderBar session={session ?? null} pending={session === undefined} phone={{ title: "", back: "/" }} />
      <Main narrow>
        <EmptyState icon="error" as="h1" title={<span id="err-t" tabIndex={-1}>문제가 생겼어요</span>} action={<Button size="sm" onClick={() => retry()}>다시 시도</Button>}>
          잠시 뒤 다시 해 주세요.
        </EmptyState>
      </Main>
    </>
  );
}
