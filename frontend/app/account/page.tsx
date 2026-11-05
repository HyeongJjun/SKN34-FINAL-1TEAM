import Link from "next/link";
import { SiteHeader } from "@/components/site/SiteHeader";
import { AccountRows } from "@/components/my/AccountRows";
import { LogoutButton, SoonButton, WithdrawButton } from "@/components/my/AccountActions";
import { Check } from "@/components/vendors/icons";
import { dateSeoul, md } from "@/lib/format";
import { requireRole } from "@/lib/session";
import s from "@/components/my/account.module.css";

export const metadata = { title: "내 정보" };

// 내 정보 (시안 WAccount). 헤더 계정 메뉴에서 들어온다. 고객과 업체가 함께 쓴다.
// 01 기본 정보: 이름 · 휴대폰은 바꿀 수 있다(PATCH /me). 이메일은 로그인 아이디라 글자로만 보인다.
// 02 로그인 방법: 비밀번호 바꾸기 · 카카오 연결은 서버 기능이 아직 없어 누르면 준비 중 안내만 보인다.
// 03 알림 받기: 화면 알림은 늘 켜져 있다(끄는 설정 · 공사 소식 알림 동의는 서버 기능이 생기면 더한다).
// 회원 탈퇴는 이 화면의 확인 창에서 비밀번호를 다시 받는다.
export default async function AccountPage() {
  const me = await requireRole(["customer", "vendor"], "/account");
  const vendor = me.role === "vendor";
  const home = vendor ? { href: "/vendor", label: "작업함" } : { href: "/my", label: "내 공사" };
  return (
    <>
      <SiteHeader />
      <main id="main">
        <nav className="mj-wrap mj-crumb" aria-label="이동 경로" style={{ paddingTop: 20 }}>
          <ol>
            <li><Link href={home.href}>{home.label}</Link><span aria-hidden="true">›</span></li>
            <li><span aria-current="page">내 정보</span></li>
          </ol>
        </nav>
        <div className={`mj-wrap ${s.head}`}>
          <h1 className="mj-h1">내 정보</h1>
          <p className="mj-sub mj-num">{vendor ? "업체 회원" : "고객 회원"} · {md(dateSeoul(me.joinedAt))} 가입</p>
        </div>

        <section className="mj-wrap" aria-labelledby="ac-s1">
          <div className="mj-sec">
            <div className="mj-sec-l"><p className="mj-code">01</p><h2 id="ac-s1" className="mj-h2">기본 정보</h2></div>
            <div className="mj-sec-c"><AccountRows name={me.name} phone={me.phone} email={me.email} vendor={vendor} /></div>
          </div>
        </section>

        <section className="mj-wrap" aria-labelledby="ac-s2">
          <div className="mj-sec">
            <div className="mj-sec-l"><p className="mj-code">02</p><h2 id="ac-s2" className="mj-h2">로그인 방법</h2></div>
            <div className="mj-sec-c">
              <dl className={s.rows}>
                <div className={s.ln}>
                  <dt>이메일 · 비밀번호</dt>
                  <dd className={s.grow}><span className="mj-st mj-st-ok"><Check size={16} />쓰는 중</span></dd>
                  <dd className={s.act}><SoonButton label="비밀번호 바꾸기" soon="비밀번호 바꾸기는 준비 중이에요." /></dd>
                </div>
                <div className={s.ln}>
                  <dt>카카오</dt>
                  <dd className={s.grow}><span className="mj-st mj-st-off">연결 안 함</span></dd>
                  <dd className={s.act}><SoonButton label="카카오 연결하기" soon="카카오 연결은 준비 중이에요." /></dd>
                </div>
              </dl>
              <p className={s.logout}><LogoutButton /></p>
            </div>
          </div>
        </section>

        <section className="mj-wrap" aria-labelledby="ac-s3">
          <div className="mj-sec">
            <div className="mj-sec-l"><p className="mj-code">03</p><h2 id="ac-s3" className="mj-h2">알림 받기</h2></div>
            <div className="mj-sec-c">
              <dl className={s.rows}>
                <div className={s.ln}>
                  <dt>공사 진행 알림</dt>
                  <dd className={s.grow}><span className="mj-small">{vendor ? "실측 요청 · 업체 확정 · 공사 날짜가 바뀌면 알림 목록에 띄워요." : "실측 · 견적서 · 공사 날짜가 바뀌면 알림 목록에 띄워요."}</span></dd>
                  <dd className={s.act}><span className="mj-st mj-st-ok"><Check size={16} />늘 켜져 있어요</span></dd>
                </div>
              </dl>
              <p><Link className="mj-lnk" href="/notifications">받은 알림 보기</Link></p>
            </div>
          </div>
        </section>

        <div className={`mj-wrap ${s.end}`}>
          <div className={s.endIn}><WithdrawButton vendor={vendor} /></div>
        </div>
      </main>
    </>
  );
}
