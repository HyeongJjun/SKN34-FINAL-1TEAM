"use client";
// 카카오로 로그인 · 가입 버튼. 카카오에서 휴대폰 번호를 받는다고 보고 휴대폰 번호 화면으로 보내지 않는다.
// 카카오 연결은 나중 작업이라 지금은 누르면 그 자리에 준비 중 안내만 보인다.
// (연결할 때: 카카오가 번호를 주지 않은 사람만 /signup/phone 으로 보낸다)
import { useState } from "react";
import { KakaoMark } from "./parts";
import s from "./auth.module.css";

export function KakaoButton({ label, soon, onBefore }: {
  label: string;
  /** 누르면 보일 준비 중 안내 */
  soon: string;
  /** 누르기 전에 확인할 것(가입 화면의 필수 약관). false면 안내를 띄우지 않는다 */
  onBefore?: () => boolean;
}) {
  const [shown, setShown] = useState(false);
  return (
    <>
      <button type="button" className={s.kakao} onClick={() => { if (onBefore && !onBefore()) return; setShown(true); }}><KakaoMark />{label}</button>
      {shown ? <div className={`mj-notice ${s.notice}`} role="status"><span>{soon}</span></div> : null}
    </>
  );
}
