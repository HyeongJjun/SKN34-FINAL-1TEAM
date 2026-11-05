// 로그인 전 화면(첫 화면 · 자주 묻는 질문) 아래 업체 안내 띠
import Link from "next/link";
import s from "./VendorBand.module.css";

export function VendorBand() {
  return (
    <aside className={s.band} aria-label="업체 안내">
      <div className={`mj-wrap ${s.in}`}>
        <p className={s.t}>인테리어 업체이신가요?</p>
        <Link className="mj-lnk" href="/signup/vendor">업체로 가입 신청</Link>
      </div>
    </aside>
  );
}
