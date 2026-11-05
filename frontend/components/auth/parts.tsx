// 가입 · 로그인 화면이 같이 쓰는 조각: 휴대폰 번호 규칙, 칸 아래 오류, 가입 | 로그인 탭, '또는 이메일로' 구분선, 카카오 표시.
// 상태가 없어서 서버 화면과 브라우저 폼 양쪽에서 쓴다.
import Link from "next/link";
import type { ReactNode } from "react";
import { withNext } from "./next";
import s from "./auth.module.css";

/** 휴대폰 번호: 서버와 같은 규칙(하이픈 · 띄어쓰기를 빼고 01로 시작하는 10~11자리) */
export const phoneOk = (v: string) => /^01[0-9]{8,9}$/.test(v.replace(/[\s-]/g, ""));
export const PHONE_MSG = "휴대폰 번호를 확인해 주세요. 예: 010-1234-5678";

/** 칸 아래 오류 한 줄. 색만으로 알리지 않게 느낌표 모양을 붙인다. */
export function FieldError({ id, alert, children }: { id: string; alert?: boolean; children: ReactNode }) {
  return (
    <p id={id} className={`mj-error ${s.err}`} role={alert ? "alert" : undefined}>
      <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="9" cy="9" r="7.2" /><path d="M9 5.2v4.6" /><path d="M9 12.4v.4" strokeLinecap="round" /></svg>
      <span>{children}</span>
    </p>
  );
}

/** 칸 이름 옆 '(필수)' */
export function Req() {
  return <span className={s.req}>(필수)</span>;
}

/** 가입 | 로그인 탭. 돌아갈 곳(next)은 그대로 넘긴다. */
export function AuthTabs({ current, next }: { current: "signup" | "login"; next?: string | null }) {
  return (
    <nav aria-label="가입 또는 로그인" className={s.tabs}>
      <Link className={s.tab} href={withNext("/signup", next)} aria-current={current === "signup" ? "page" : undefined}>가입</Link>
      <Link className={s.tab} href={withNext("/login", next)} aria-current={current === "login" ? "page" : undefined}>로그인</Link>
    </nav>
  );
}

export function OrEmail() {
  return <p className={s.or}>또는 이메일로</p>;
}

export function KakaoMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 3C5.3 3 1.8 5.9 1.8 9.4c0 2.3 1.5 4.3 3.8 5.4l-.9 3.3c-.1.3.3.5.5.3l3.9-2.6c.3 0 .6.1.9.1 4.7 0 8.2-2.9 8.2-6.5S14.7 3 10 3z" fill="currentColor" />
    </svg>
  );
}

export function VendorJoin() {
  return <p className={`mj-small ${s.foot}`}>인테리어 업체이신가요? <Link className={`mj-lnk ${s.lnk}`} href="/signup/vendor">업체로 가입 신청</Link></p>;
}
