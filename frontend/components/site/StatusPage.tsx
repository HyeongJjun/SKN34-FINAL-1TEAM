// 상태 화면 본문(시안 WStatus). 머리 · 바닥글은 그대로 두고 본문만 바꾼다.
// 404 · 500 같은 번호는 고객센터에 알릴 때 쓰도록 작게만 보이고, 저절로 새로 고치지 않는다.
import Link from "next/link";
import type { ReactNode } from "react";
import type { Role, Session } from "@/lib/types";
import { LogoutButton, ReloadButton } from "./StatusActions";
import s from "./StatusPage.module.css";

/** 화면 전체가 바뀌면 이 제목으로 초점을 옮긴다(app/error.tsx). */
export const STATUS_TITLE_ID = "status-title";

export function StatusPage({ code, title, children, actions }: { code?: string; title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <main id="main" className={`mj-wrap ${s.main}`}>
      {code ? <p className="mj-code">{code}</p> : null}
      <h1 id={STATUS_TITLE_ID} className="mj-h1" tabIndex={-1}>{title}</h1>
      {children}
      {actions ? <div className={s.acts}>{actions}</div> : null}
    </main>
  );
}

const HOME_ACTION: Record<Role, { href: string; label: string }> = {
  customer: { href: "/my", label: "내 공사로" },
  vendor: { href: "/vendor", label: "작업함으로" },
  admin: { href: "/admin/vendors", label: "업체 심사로" },
};
const ROLE_WORD: Record<Role, string> = { customer: "고객", vendor: "업체", admin: "관리자" };

/** 로그인했으면 그 역할의 첫 화면, 아니면 로그인 */
export function homeAction(session: Session | null) {
  return session ? HOME_ACTION[session.role] : { href: "/login", label: "로그인" };
}

/** 로그인 뒤 돌아올 곳은 이 사이트 안 경로만 받는다. */
function nextQuery(next?: string) {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? `?next=${encodeURIComponent(next)}` : "";
}

/** 401 · 로그인 필요. reason은 첫 문장(예: '시공 상담은 로그인한 고객이 쓸 수 있어요.') */
export function LoginRequired({ next, reason = "이 화면은 로그인한 뒤에 볼 수 있어요." }: { next?: string; reason?: string }) {
  const q = nextQuery(next);
  return (
    <StatusPage
      title="로그인하면 볼 수 있어요"
      actions={<><Link className="mj-btn mj-btn-pri" href={`/login${q}`}>로그인</Link><Link className="mj-btn mj-btn-sec" href={`/signup${q}`}>가입하기</Link></>}
    >
      <p className="mj-sub">{reason} 로그인하면 이 화면으로 바로 돌아와요.</p>
    </StatusPage>
  );
}

/** 503 · 점검. 시각은 정해진 때만 넘긴다(짐작한 시각은 적지 않는다). 예: period="11.03(화) 02:00 ~ 04:00" */
export function Maintenance({ period, reopen }: { period?: string; reopen?: string }) {
  return (
    <StatusPage code="503" title="점검하고 있어요" actions={<ReloadButton />}>
      {period || reopen ? (
        <dl className={s.kv}>
          {period ? <><dt>점검 시간</dt><dd className="mj-num">{period}</dd></> : null}
          {reopen ? <><dt>다시 여는 시각</dt><dd className={`mj-num ${s.big}`}>{reopen}</dd></> : null}
        </dl>
      ) : null}
      <p className="mj-sub">{reopen ? "다시 여는 시각이 지나면 새로 고쳐 주세요." : "잠시 뒤에 다시 열어 주세요."}</p>
    </StatusPage>
  );
}

/** 403 · 권한 없음. 남의 공사는 이것 대신 404로, 승인 전 업체는 업체 홈으로 보낸다. reason 예: '업체 작업함은 업체 계정으로 들어와요.' */
export function Forbidden({ session, reason }: { session: Session; reason?: string }) {
  const home = HOME_ACTION[session.role];
  const who = ROLE_WORD[session.role];
  return (
    <StatusPage
      code="403"
      title={`${who} 계정으로는 볼 수 없는 화면이에요`}
      actions={<><Link className="mj-btn mj-btn-pri" href={home.href}>{home.label}</Link><LogoutButton /></>}
    >
      <p className="mj-sub">{reason ? `${reason} ` : ""}지금은 {session.name} 님({who})으로 로그인해 있어요.</p>
    </StatusPage>
  );
}
