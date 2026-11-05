"use client";
// 500 · 잠시 문제가 생겼어요. 화면을 그리다 난 오류만 이 화면으로 바꾼다(보내다 난 오류는 버튼 아래 글자로 알린다).
// 오류 경계는 브라우저 컴포넌트라 서버 머리(SiteHeader)를 못 쓴다. /me로 누구인지 읽어 같은 머리(HeaderBar)를 그린다.
import { useEffect, useState } from "react";
import Link from "next/link";
import { call, type Schemas } from "@/lib/backend/client";
import { HeaderBar } from "@/components/site/HeaderBar";
import { STATUS_TITLE_ID, StatusPage } from "@/components/site/StatusPage";
import { dateSeoul, md } from "@/lib/format";
import type { Role, Session } from "@/lib/types";

const ROLES: Role[] = ["customer", "vendor", "admin"];
const CLOCK = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false });

function toSession(me: Schemas["MeOut"]): Session | null {
  if (!ROLES.includes(me.role as Role)) return null;
  return { id: me.id, email: me.email, name: me.name, role: me.role as Role, vendorStatus: me.vendor_status ?? null, vendorRejectReason: me.vendor_reject_reason ?? null, phone: me.phone ?? null, joinedAt: me.created_at };
}

export default function ErrorPage({ retry }: { error: unknown; retry: () => void }) {
  // undefined: 아직 모름(로고만), null: 비로그인
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [at, setAt] = useState<string | null>(null);

  useEffect(() => {
    document.getElementById(STATUS_TITLE_ID)?.focus();
    const now = new Date();
    setAt(`${md(dateSeoul(now.toISOString()))} ${CLOCK.format(now)}`);
    let alive = true;
    call<Schemas["MeOut"]>("GET", "/me")
      .then((me) => { if (alive) setSession(toSession(me)); })
      .catch(() => { if (alive) setSession(null); });
    return () => { alive = false; };
  }, []);

  return (
    <>
      <title>잠시 문제가 생겼어요 · 믿집</title>
      <HeaderBar session={session ?? null} pending={session === undefined} />
      <StatusPage
        code="500"
        title="잠시 문제가 생겼어요"
        actions={<><button type="button" className="mj-btn mj-btn-pri" onClick={() => retry()}>다시 시도</button><Link className="mj-btn mj-btn-sec" href="/legal#contact">고객센터</Link></>}
      >
        <p className="mj-sub">믿집 서버가 요청을 처리하지 못했어요. 잠시 뒤에 다시 시도해 주세요.</p>
        <p className="mj-small">계속 같으면 고객센터에 알려 주세요.{at ? <> 오류가 난 시각 <b className="mj-num">{at}</b></> : null}</p>
      </StatusPage>
    </>
  );
}
