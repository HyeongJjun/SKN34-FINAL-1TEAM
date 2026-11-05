// 자주 묻는 질문(시안 WGuide). 정적 질문 목록이고, 찾기는 주소의 ?q= 로 서버에서 거른다.
// 상담(로그인하면 묻기)으로 잇는 칸은 상담 챗이 보류라 두지 않는다.
import Link from "next/link";
import { SiteHeader } from "@/components/site/SiteHeader";
import { FaqList } from "@/components/site/FaqList";
import { VendorBand } from "@/components/site/VendorBand";
import { FAQ, searchFaq } from "@/components/site/faq";
import s from "./faq.module.css";

export const metadata = { title: "자주 묻는 질문" };

export default async function FaqPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw ?? "").trim().slice(0, 100);
  const groups = q ? searchFaq(q) : FAQ;
  const count = groups.reduce((n, g) => n + g.items.length, 0);
  return (
    <>
      <SiteHeader />
      <main id="main">
        <div className={`mj-wrap ${s.top}`}>
          <div className={s.head}>
            <div className={s.title}>
              <h1 className="mj-h1">자주 묻는 질문</h1>
            </div>
            <form role="search" aria-label="질문 찾기" action="/faq" className={s.search}>
              <label htmlFor="gq" className={s.label}>무엇이 궁금해요?</label>
              <div className={s.searchRow}>
                <input id="gq" name="q" type="search" className={`mj-input ${s.input}`} placeholder="예: 벽지가 울어요" defaultValue={q} maxLength={100} />
                <button type="submit" className={`mj-btn mj-btn-sec ${s.go}`}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="8" cy="8" r="5.5" /><path d="M12.2 12.2L16 16" /></svg>
                  찾기
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className={`mj-wrap ${s.body}`}>
          <div className={s.col}>
            {q ? (
              <p className={s.found}>
                {count ? <>찾는 말 ‘{q}’ · 질문 {count}개예요.</> : <>찾는 말 ‘{q}’에 맞는 질문이 없어요.</>}
                {" "}<Link href="/faq">모든 질문 보기</Link>
              </p>
            ) : null}
            {count ? <FaqList groups={groups} initialOpen={groups[0].items[0].id} /> : null}
          </div>
        </div>
      </main>
      <VendorBand />
    </>
  );
}
