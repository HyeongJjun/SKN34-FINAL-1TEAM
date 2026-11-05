// 약관 · 개인정보처리방침 · 고객센터 · 사업자 정보(시안 WLegal).
// [내용 자리] · [대괄호]는 아직 정하지 않은 글 자리다. 판에 없는 법적 문구는 짓지 않는다.
import Link from "next/link";
import { SiteHeader } from "@/components/site/SiteHeader";
import s from "./legal.module.css";

export const metadata = { title: "약관 · 개인정보처리방침 · 고객센터" };

const TODO = "[내용 자리]";

const CUSTOMER_TERMS = [
  "제1조 (목적)", "제2조 (용어의 뜻)", "제3조 (약관의 게시와 변경)", "제4조 (회원 가입과 계정)", "제5조 (서비스의 내용)",
  "제6조 (표준견적서 · 예상 공정표의 성격)", "제7조 (시공 상담 자동 답변)", "제8조 (실측 요청과 연락처 공개)", "제9조 (믿집의 지위와 책임의 범위)",
  "제10조 (회원의 의무)", "제11조 (탈퇴와 이용 제한)", "제12조 (서비스의 중단)", "제13조 (분쟁 해결과 관할)", "부칙",
];
const VENDOR_TERMS = [
  "제1조 (목적)", "제2조 (가입 신청과 심사)", "제3조 (보완 요청과 거절)", "제4조 (업체 정보 · 단가 등록)", "제5조 (견적서 작성과 제출)",
  "제6조 (고객 정보의 이용 제한)", "제7조 (승인 취소와 이용 제한)", "제8조 (분쟁 처리)", "부칙",
];
const PRIVACY_TOC = ["처리 목적", "처리하는 항목", "보유 기간", "제3자 제공", "처리 위탁", "파기", "정보주체의 권리", "안전성 확보 조치", "개인정보 보호책임자", "변경 이력"];

function no(i: number) {
  return String(i).padStart(2, "0");
}

function Articles({ items }: { items: string[] }) {
  return (
    <ol className={s.art}>
      {items.map((t) => <li key={t}><h4>{t}</h4><p>{TODO}</p></li>)}
    </ol>
  );
}

function History({ caption }: { caption: string }) {
  return (
    <table className="mj-table">
      <caption className="mj-sr">{caption}</caption>
      <thead><tr><th scope="col">버전</th><th scope="col">시행일</th><th scope="col">바뀐 것</th></tr></thead>
      <tbody><tr><th scope="row" className="mj-code">1.0</th><td>[시행일]</td><td>처음 시행 · 지금 버전</td></tr></tbody>
    </table>
  );
}

function Kv({ rows }: { rows: [string, string][] }) {
  return (
    <dl className={s.kv}>
      {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
    </dl>
  );
}

export default function LegalPage() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <div className={`mj-wrap ${s.top}`}>
          <h1 className="mj-h1">약관 · 개인정보처리방침 · 고객센터</h1>
        </div>

        <div className={`mj-wrap ${s.layout}`}>
          <nav className={s.toc} aria-label="문서 목차">
            <p className={s.tocT}>목차</p>
            <ol>
              <li>
                <a href="#terms">이용약관</a>
                <ol>
                  <li><a href="#terms-customer">고객 이용약관</a></li>
                  <li><a href="#vendor-terms">업체 이용약관</a></li>
                  <li><a href="#marketing">공사 소식 알림 동의</a></li>
                </ol>
              </li>
              <li><a href="#privacy">개인정보처리방침</a></li>
              <li><a href="#contact">고객센터</a></li>
              <li><a href="#biz">사업자 정보</a></li>
            </ol>
          </nav>

          <div className={s.docs}>
            <section id="terms" className={s.doc} aria-labelledby="terms-t">
              <div className={s.dh}>
                <h2 id="terms-t">이용약관</h2>
                <p className={s.meta}><span className="mj-code">버전 1.0 · 시행일 [시행일]</span></p>
              </div>

              <h3 id="terms-customer" className="mj-h3">고객 이용약관</h3>
              <Articles items={CUSTOMER_TERMS} />

              <h3 id="vendor-terms" className="mj-h3">업체 이용약관</h3>
              <Articles items={VENDOR_TERMS} />

              <h3 id="marketing" className="mj-h3">공사 소식 알림 받기 <span className={s.opt}>(선택 동의)</span></h3>
              <ol className={s.art}>
                <li><h4>받는 내용</h4><p>{TODO}</p></li>
                <li><h4>받는 방법</h4><p>믿집 화면 알림</p></li>
                <li><h4>동의 철회</h4><p>{TODO} <Link href="/account">내 정보에서 켜고 끄기</Link></p></li>
              </ol>

              <div id="terms-history" className={s.hist}>
                <h3 className="mj-h3">이용약관 변경 이력</h3>
                <History caption="이용약관 변경 이력" />
              </div>
            </section>

            <section id="privacy" className={s.doc} aria-labelledby="privacy-t">
              <div className={s.dh}>
                <h2 id="privacy-t">개인정보처리방침</h2>
                <p className={s.meta}><span className="mj-code">버전 1.0 · 시행일 [시행일]</span></p>
              </div>
              <nav aria-label="개인정보처리방침 항목">
                <ol className={s.pvt}>
                  {PRIVACY_TOC.map((t, i) => <li key={t}><a href={`#pv-${i + 1}`}><span className="mj-code">{no(i + 1)}</span>{t}</a></li>)}
                </ol>
              </nav>

              <div id="pv-1" className={s.pv}>
                <h3 className="mj-h3"><span className="mj-code">01</span> 처리 목적</h3>
                <p className={s.ph}>{TODO}</p>
              </div>

              <div id="pv-2" className={s.pv}>
                <h3 className="mj-h3"><span className="mj-code">02</span> 처리하는 항목</h3>
                <div className="mj-table-box" tabIndex={0} role="region" aria-label="처리하는 개인정보 항목 표, 옆으로 넘겨 볼 수 있어요">
                  <table className="mj-table">
                    <caption className="mj-sr">처리하는 개인정보 항목</caption>
                    <thead><tr><th scope="col">누구</th><th scope="col">항목</th><th scope="col">받는 때</th></tr></thead>
                    <tbody>
                      <tr><th scope="row">고객</th><td>이름 · 이메일 · 비밀번호(암호화) · 휴대폰, 카카오로 시작하면 카카오 계정 정보</td><td>가입할 때</td></tr>
                      <tr><th scope="row">고객</th><td>주소 · 집 정보(면적 · 준공연도 · 공간) · 공간 사진 · 도면</td><td>견적 받기 때 (동 · 호수는 실측 요청 때)</td></tr>
                      <tr><th scope="row">고객</th><td>시공 상담 기록</td><td>상담할 때 (그 공사의 상담 기록으로 남고, 전화번호 · 주소는 가려 저장해요)</td></tr>
                      <tr><th scope="row">업체</th><td>대표자 이름 · 이메일 · 비밀번호(암호화) · 휴대폰 · 사업자등록번호 · 사업자등록증</td><td>가입 신청할 때</td></tr>
                      <tr><th scope="row">모두</th><td>접속 기록 · 로그인 유지 쿠키</td><td>쓰는 동안 자동으로</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div id="pv-3" className={s.pv}>
                <h3 className="mj-h3"><span className="mj-code">03</span> 보유 기간</h3>
                <p className={s.ph}>{TODO}</p>
                <div className="mj-table-box" tabIndex={0} role="region" aria-label="연락처가 서로 보이는 기간 표, 옆으로 넘겨 볼 수 있어요">
                  <table className="mj-table">
                    <caption>고객과 업체의 연락처가 서로 보이는 기간</caption>
                    <thead><tr><th scope="col">경우</th><th scope="col">보이는 기간</th></tr></thead>
                    <tbody>
                      <tr><th scope="row">확정한 업체와 고객</th><td>공사가 끝난 날부터 1년까지 (하자 보수 연락)</td></tr>
                      <tr><th scope="row">고르지 않았거나 취소된 실측 요청</th><td>요청이 닫히면 바로 가려요</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div id="pv-4" className={s.pv}>
                <h3 className="mj-h3"><span className="mj-code">04</span> 제3자 제공</h3>
                <div className="mj-table-box" tabIndex={0} role="region" aria-label="개인정보를 제공받는 곳 표, 옆으로 넘겨 볼 수 있어요">
                  <table className={`mj-table ${s.wide}`}>
                    <caption className="mj-sr">개인정보를 제공받는 곳</caption>
                    <thead><tr><th scope="col">받는 곳</th><th scope="col">주는 항목</th><th scope="col">주는 때</th><th scope="col">받는 곳의 이용 목적</th><th scope="col">보유 기간</th></tr></thead>
                    <tbody>
                      <tr><th scope="row">고객이 실측을 요청한 업체</th><td>고객 이름 · 휴대폰 · 주소(동 · 호수 포함) · 집 정보</td><td>실측 요청을 보낼 때</td><td>실측 방문 · 견적 · 공사 · 하자 보수 연락</td><td>확정하면 공사가 끝난 날부터 1년, 고르지 않거나 취소하면 요청이 닫힐 때까지</td></tr>
                      <tr><th scope="row">그 업체에 실측을 요청한 고객</th><td>업체 대표자 이름 · 전화번호</td><td>실측 요청을 보낼 때</td><td>실측 · 공사 · 하자 보수 연락</td><td>위와 같아요</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div id="pv-5" className={s.pv}>
                <h3 className="mj-h3"><span className="mj-code">05</span> 처리 위탁</h3>
                <div className="mj-table-box" tabIndex={0} role="region" aria-label="처리를 맡기는 곳 표, 옆으로 넘겨 볼 수 있어요">
                  <table className="mj-table">
                    <caption className="mj-sr">개인정보 처리를 맡기는 곳</caption>
                    <thead><tr><th scope="col">맡는 곳</th><th scope="col">맡기는 일</th></tr></thead>
                    <tbody>
                      <tr><th scope="row">[호스팅 사업자]</th><td>서버 운영 · 자료 보관</td></tr>
                      <tr><th scope="row">[자동 답변 제공자]</th><td>시공 상담 질문으로 답 만들기</td></tr>
                    </tbody>
                  </table>
                </div>
                <p className={s.ph}>국외로 옮기는 개인정보: {TODO}</p>
              </div>

              <div id="pv-6" className={s.pv}>
                <h3 className="mj-h3"><span className="mj-code">06</span> 파기</h3>
                <p className={s.ph}>{TODO}</p>
              </div>

              <div id="pv-7" className={s.pv}>
                <h3 className="mj-h3"><span className="mj-code">07</span> 정보주체의 권리</h3>
                <p className={s.ph}>{TODO}</p>
                <div><Link className="mj-lnk" href="/account">내 정보에서 보기 · 고치기 · 탈퇴하기</Link></div>
              </div>

              <div id="pv-8" className={s.pv}>
                <h3 className="mj-h3"><span className="mj-code">08</span> 안전성 확보 조치</h3>
                <p className={s.ph}>{TODO}</p>
              </div>

              <div id="pv-9" className={s.pv}>
                <h3 className="mj-h3"><span className="mj-code">09</span> 개인정보 보호책임자</h3>
                <Kv rows={[["성명", "[성명]"], ["직책", "[직책]"], ["전화", "[전화번호]"], ["이메일", "[이메일 주소]"]]} />
              </div>

              <div id="pv-10" className={s.pv}>
                <h3 className="mj-h3"><span className="mj-code">10</span> 변경 이력</h3>
                <History caption="개인정보처리방침 변경 이력" />
              </div>
            </section>

            <section id="contact" className={s.doc} aria-labelledby="contact-t">
              <div className={s.dh}><h2 id="contact-t">고객센터</h2></div>
              <dl className={s.kv}>
                <div><dt>운영 시간</dt><dd className="mj-num">평일 10:00–18:00<span className="mj-small">휴일(주말 · 공휴일)에는 답하지 않아요</span></dd></div>
                <div><dt>전화</dt><dd>[전화번호]</dd></div>
                <div><dt>이메일</dt><dd>[이메일 주소]</dd></div>
              </dl>
            </section>

            <section id="biz" className={s.doc} aria-labelledby="biz-t">
              <div className={s.dh}><h2 id="biz-t">사업자 정보</h2></div>
              <table className={`mj-table ${s.narrow}`}>
                <caption className="mj-sr">믿집 사업자 정보</caption>
                <tbody>
                  <tr><th scope="row" className={s.th}>상호</th><td>[상호]</td></tr>
                  <tr><th scope="row">대표자</th><td>[대표자]</td></tr>
                  <tr><th scope="row">사업장 주소</th><td>[사업장 주소]</td></tr>
                  <tr><th scope="row">사업자등록번호</th><td className="mj-num">[000-00-00000]</td></tr>
                  <tr><th scope="row">통신판매업 신고</th><td>[번호]</td></tr>
                  <tr><th scope="row">호스팅 제공자</th><td>[호스팅 사업자]</td></tr>
                  <tr><th scope="row">전화</th><td>[전화번호]</td></tr>
                  <tr><th scope="row">이메일</th><td>[이메일 주소]</td></tr>
                </tbody>
              </table>
              <p className={s.strong}>믿집은 고객과 업체를 이어 주는 중개 서비스예요. 공사 계약의 당사자는 고객과 업체예요.</p>
              <div><a className="mj-lnk" href="https://www.ftc.go.kr/" target="_blank" rel="noopener noreferrer">공정거래위원회 사업자정보 확인 <span className={s.normal}>(새 창)</span></a></div>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
