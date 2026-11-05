// 모든 화면 맨 아래 바닥글(시안 WFooter). 법정 표시 · 중개 고지 줄은 여기 한 곳에서만 바꾼다.
// [대괄호]는 아직 정하지 않은 사업자 정보 자리다.
import Link from "next/link";
import s from "./SiteFooter.module.css";

export function SiteFooter() {
  return (
    <footer className={s.foot}>
      <div className={`mj-wrap ${s.in}`}>
        <nav aria-label="바닥글" className={s.nav}>
          <Link href="/legal#terms">이용약관</Link>
          <Link href="/legal#privacy" className={s.strong}>개인정보처리방침</Link>
          <Link href="/signup/vendor">업체 입점 안내</Link>
          <Link href="/legal#contact">고객센터</Link>
        </nav>
        <p>믿집 · 상호 [상호] · 대표 [대표자] · 주소 [사업장 주소] · 사업자등록번호 [000-00-00000] <Link href="/legal#biz">사업자정보 확인</Link> · 통신판매업 신고 [번호] · 이메일 [이메일 주소] · 고객센터 [전화번호] (평일 10:00–18:00) · 호스팅 제공자 [호스팅 사업자]</p>
        <p>믿집은 고객과 업체를 이어 주는 중개 서비스예요. 공사 계약의 당사자는 고객과 업체예요.</p>
        <p>표준견적서와 가견적은 공공 기준 단가와 업체가 낸 단가로 믿집이 계산한 참고 금액이에요. 공사 금액은 업체의 실측 견적서로 정해져요.</p>
      </div>
    </footer>
  );
}
