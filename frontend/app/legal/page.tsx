// /legal — 약관 · 개인정보 처리방침(C55, CF-59). 가입 동의 '보기'(?tab=terms · privacy)와 홈 · 내 정보에서 와요.
// 실제 약관 · 처리방침은 법무가 써요. 여기 글은 9판 예시(처리방침 다섯 줄)와 이미 정한 서비스 규칙만 옮겼어요.
// '업체가 보는 기간: 정할 것'은 S18 B(제한 없음)와 개인정보보호법 제17조② 법무 확인(팀 확인 7) 전이라 그대로 둬요.
import Link from "next/link";
import { AppHeader } from "@/components/site/AppHeader";
import { Main, PageHead } from "@/components/site/Frame";
import s from "./legal.module.css";

export const metadata = { title: "약관 · 개인정보 처리방침" };

const PRIVACY: [string, string][] = [
  ["1. 모으는 정보", "이메일 · 이름 · 휴대폰(선택) · 집 정보(지역 · 면적 · 상태) · 사진"],
  ["2. 쓰는 곳", "표준견적서 계산 · 업체 연결 · 화면 알림"],
  ["3. 업체에 주는 정보", "믿집은 동네(구 · 동) · 면적 · 집 상태 · 사진만 줘요. 동 · 호수 · 연락처는 고객이 채팅에 직접 쓸 때만 그 업체가 봐요. 예산은 요청서에 함께 가요. 업체가 보는 기간: 정할 것"],
  ["4. 보관 · 파기", "탈퇴하면 지워요. 법에 정한 기록은 그 기간 동안 보관해요"],
  ["5. AI를 쓰는 곳", "질문에 답할 때 AI를 써요. 금액 · 날짜는 믿집 계산 그대로예요"],
  ["6. 로그인 전에 넣은 답", "가입 전 기본 정보는 이 기기에만 저장되고 30일이 지나면 지워요. 가입하면 내 공사로 옮기고 기기에서는 지워요"],
];

const TERMS: [string, string][] = [
  ["1. 믿집이 하는 일", "표준견적서 계산 · 업체 가견적 보기 · 실측 일정 잡기 · 업체와 채팅 · 화면 알림"],
  ["2. 표준견적서 · 가견적", "시장 데이터 기준으로 계산한 참고 금액이에요. 업체 견적은 실측 뒤 업체가 내요"],
  ["3. 믿집이 하지 않는 일", "계약 · 결제 · 시공 보증은 하지 않아요. 돈은 업체와 직접 주고받아요"],
  ["4. 리뷰 · 신고", "믿집에서 공사를 끝낸 고객만 리뷰를 써요. 믿집 밖 거래 권유 · 막말은 신고할 수 있어요"],
  ["5. 탈퇴", "내 정보에서 언제든 탈퇴할 수 있어요"],
];

export default async function LegalPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const tab = (await searchParams).tab === "privacy" ? "privacy" : "terms";
  const rows = tab === "privacy" ? PRIVACY : TERMS;
  return (
    <>
      <AppHeader phone={{ title: "약관 · 개인정보 처리방침", back: "/" }} />
      <Main narrow>
        <PageHead title="약관 · 개인정보 처리방침" />
        <section className={s.group} aria-labelledby="lg-t">
          <nav aria-label="문서 고르기" className={s.seg}>
            <Link className={s.tab} href="/legal?tab=terms" aria-current={tab === "terms" ? "page" : undefined}>이용약관</Link>
            <Link className={s.tab} href="/legal?tab=privacy" aria-current={tab === "privacy" ? "page" : undefined}>개인정보 처리방침</Link>
          </nav>
          <p className={s.sm}>시행일과 문구는 예시예요</p>
        </section>
        <section className={s.group}>
          <h2 id="lg-t" className="mj-sr">{tab === "privacy" ? "개인정보 처리방침" : "이용약관"}</h2>
          <ul className={s.rows}>
            {rows.map(([t, d]) => <li key={t}><b>{t}</b><span>{d}</span></li>)}
          </ul>
        </section>
      </Main>
    </>
  );
}
