import Link from "next/link";
import s from "./auth.module.css";

export function ResetPassword() {
  return (
    <div className={s.single}>
      <div className={s.head}>
        <h1 className="mj-h1">비밀번호 찾기</h1>
        <p className="mj-sub">비밀번호 재설정 기능을 준비하고 있어요.</p>
      </div>
      <p>지금은 재설정 메일을 보내거나 비밀번호를 바꿀 수 없어요.</p>
      <div>
        <Link className="mj-btn mj-btn-pri" href="/login">로그인으로 돌아가기</Link>
      </div>
    </div>
  );
}
