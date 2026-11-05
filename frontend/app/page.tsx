// 첫 화면(시안 WHome · 정적). 견본 숫자는 시안의 계산 엔진 결과(상계동 32평 · 2026 하반기 단가)를 그대로 옮긴 것이다.
// 02 구역은 표준견적서 줄이 합계에 들어가는지 · 실측 뒤 업체가 정하는지를 보여 준다.
// 03 구역은 자주 묻는 질문 미리 보기다. 질문을 누르면 그 자리에서 답이 펼쳐진다(details).
import Link from "next/link";
import { SiteHeader } from "@/components/site/SiteHeader";
import { VendorBand } from "@/components/site/VendorBand";
import { FAQ, FAQ_PREVIEW, findFaq, type Faq } from "@/components/site/faq";
import s from "./page.module.css";

function DocIcon() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" aria-hidden="true"><path d="M3 1.5h5l3 3v8H3z" /><path d="M8 1.5v3h3" /><path d="M5 7.5h4M5 10h4" /></svg>;
}
function WaitIcon() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="7" cy="7" r="5.5" /><path d="M7 4v3.2l2 1.3" /></svg>;
}
function OkIcon() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M2.5 7.5l3 3 6-7" /></svg>;
}
function Dash({ sr }: { sr: string }) {
  return <><span aria-hidden="true">—</span><span className="mj-sr">{sr}</span></>;
}
function ChevDown() {
  return <svg className={s.chev} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3.5 6l4.5 4.5L12.5 6" /></svg>;
}
function ChevRight() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M6 3.5l4.5 4.5L6 12.5" /></svg>;
}

/** 미리 보기 답: 근거 번호([n])는 빼고 글만, 그 아래 근거 한 줄 또는 업체에 물어볼 문장 */
function PreviewAnswer({ it }: { it: Faq }) {
  const ref = it.refs?.[0];
  return (
    <div className={s.an}>
      <p>{it.body.filter((b) => typeof b === "string").join("")}</p>
      {ref ? (
        <p className="mj-small"><b className={s.ink}>근거 · {ref.short ?? ref.src}</b> {ref.plain ?? (ref.quote ? `“${ref.text}”` : ref.text)}</p>
      ) : it.ask ? (
        <p className="mj-small"><b className={s.ink}>업체에 물어볼 문장</b> “{it.ask}”</p>
      ) : null}
    </div>
  );
}

const STEPS: { t: string; d?: string; get?: string[] }[] = [
  { t: "집 정보 넣기", d: "평형 · 공간 · 사진을 넣고 도배 · 목공을 골라요" },
  { t: "기준 금액 받기", get: ["표준견적서", "예상 공정표"] },
  { t: "업체 고르기", get: ["업체별 가견적"] },
  { t: "실측 받기", get: ["실측 견적서"] },
  { t: "업체 확정하기", get: ["확정한 업체"] },
  { t: "공사 날짜 정하기", get: ["확정 공정표"] },
];

const DAYS = ["16 월", "17 화", "18 수", "19 목", "20 금", "21 토", "22 일", "23 월"];
const OFF = new Set([5, 6]); // 21 · 22일 휴일

export default async function Home({ searchParams }: { searchParams: Promise<{ bye?: string }> }) {
  const { bye } = await searchParams;
  const preview = FAQ_PREVIEW.map(findFaq).filter((it) => it !== undefined);
  const faqCount = FAQ.reduce((n, g) => n + g.items.length, 0);
  return (
    <>
      <SiteHeader />
      <main id="main">
        {bye ? (
          <div className={`mj-wrap ${s.bye}`}>
            <p className="mj-notice" role="status"><span>탈퇴했어요. 회원 정보와 프로젝트를 모두 지웠어요.</span></p>
          </div>
        ) : null}

        <section className={`mj-wrap ${s.hero}`} aria-labelledby="hero-t">
          <div className={s.heroText}>
            <h1 id="hero-t" className={s.display}>업체를 만나기 전에<br />기준 금액과 공정표부터<br />받아 보세요</h1>
            <p className={`mj-sub ${s.lead}`}>집 정보만 넣으면 기준 금액과 공정표가 바로 나와요. 업체 견적은 이 기준과 나란히 비교해요.</p>
            <div className={s.cta}>
              <Link className={`mj-btn mj-btn-pri ${s.start}`} href="/start">견적 받기 시작</Link>
            </div>
          </div>

          <div className={s.docs}>
            <figure className={`mj-paper ${s.doc}`} aria-labelledby="doc-t">
              <div className={s.docHead}>
                <p id="doc-t" className={s.docTitle}>표준견적서</p>
              </div>
              <dl className={s.meta}>
                <div><dt>현장</dt><dd>노원구 상계동 아파트</dd></div>
                <div><dt>면적</dt><dd className="mj-num">공급 105.8㎡ (32평)</dd></div>
                <div><dt>공정</dt><dd>도배 기본형 · 목공</dd></div>
              </dl>
              <div className="mj-table-box" role="region" tabIndex={0} aria-label="도배 표준견적서 견본, 옆으로 넘겨 볼 수 있어요">
                <table className={`mj-table mj-num ${s.tbl}`}>
                  <caption className="mj-sr">도배 표준견적서 견본</caption>
                  <thead><tr><th scope="col">도배</th><th scope="col" className="r">수량</th><th scope="col" className="r">금액(원)</th></tr></thead>
                  <tbody>
                    <tr><th scope="row">벽 도배 시공 (풀 포함)</th><td className="r">198.4㎡</td><td className="r">1,189,011</td></tr>
                    <tr><th scope="row">천장 도배 시공 (풀 포함)</th><td className="r">66.1㎡</td><td className="r">563,899</td></tr>
                    <tr><th scope="row">도배지 (실크)</th><td className="r">317.4㎡</td><td className="r">1,055,355</td></tr>
                    <tr><th scope="row">초배지</th><td className="r">291.0㎡</td><td className="r">70,422</td></tr>
                    <tr><th scope="row">기존 벽지 철거</th><td className="r">264.5㎡</td><td className="r"><span className="mj-st mj-st-wait"><WaitIcon />실측 후</span><span className={`mj-small ${s.cellNote}`}>실측 뒤 정해요</span></td></tr>
                    <tr><th scope="row">폐기물 처리</th><td className="r"><Dash sr="수량은 실측 후" /></td><td className="r"><span className="mj-st mj-st-wait"><WaitIcon />실측 후</span><span className={`mj-small ${s.cellNote}`}>합계 밖</span></td></tr>
                  </tbody>
                  <tfoot>
                    <tr className={s.withVat}><th scope="row">낼 금액</th><td /><td className="r">3,166,556</td></tr>
                  </tfoot>
                </table>
              </div>
            </figure>

            <figure className={`mj-paper ${s.gantt}`} aria-labelledby="gt-t">
              <p id="gt-t" className={s.gtTitle}>예상 공정표 <span>· 하루 단위</span></p>
              <div>
                <div className={`${s.gt} ${s.gtDays} mj-num`} aria-hidden="true">
                  <span />
                  {DAYS.map((d, i) => <span key={d} className={`${s.gtH} ${OFF.has(i) ? s.gtOff : ""}`}>{d}</span>)}
                </div>
                <div className={`${s.gt} ${s.gtRow}`} aria-hidden="true">
                  <span className={s.gtName}>목공</span>
                  <span className={`${s.gtBar} ${s.barA}`} style={{ gridColumn: "2 / span 3" }} />
                  <span className={s.gtOff} style={{ gridColumn: "7 / span 2" }} />
                </div>
                <div className={`${s.gt} ${s.gtRow}`} aria-hidden="true">
                  <span className={s.gtName}>도배</span>
                  <span className={`${s.gtBar} ${s.barB}`} style={{ gridColumn: "5 / span 2" }} />
                  <span className={s.gtOff} style={{ gridColumn: "7 / span 2" }} />
                  <span className={`${s.gtBar} ${s.barB}`} style={{ gridColumn: "9 / span 1" }} />
                </div>
              </div>
              <p className="mj-sr">목공 11월 16일 월요일부터 18일 수요일까지, 도배 19일 목요일부터 23일 월요일까지예요. 21일과 22일은 휴일이에요.</p>
            </figure>
          </div>
        </section>

        <section className="mj-wrap" aria-labelledby="s1">
          <div className="mj-sec mj-sec-stack">
            <div className="mj-sec-l">
              <p className="mj-code">01</p>
              <h2 id="s1" className="mj-h2">견적 받기부터 공사 날짜까지</h2>
            </div>
            <div className="mj-sec-c">
              <ol className={s.steps}>
                {STEPS.map((st, i) => (
                  <li key={st.t}>
                    <span className={s.n}>{i + 1}</span>
                    <h3 className="mj-h3">{st.t}</h3>
                    {st.d ? <p className={s.d}>{st.d}</p> : null}
                    {st.get ? (
                      <dl className={s.get}>
                        <dt className="mj-sr">받는 것</dt>
                        {st.get.map((g) => <dd key={g} className={s.got}><DocIcon />{g}</dd>)}
                      </dl>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section className="mj-wrap" aria-labelledby="s2">
          <div className="mj-sec">
            <div className="mj-sec-l">
              <p className="mj-code">02</p>
              <h2 id="s2" className="mj-h2">비용이 어디에 얼마가 드는지 미리 보여 줘요</h2>
            </div>
            <div className="mj-sec-c">
              <figure className={`mj-paper ${s.ex}`} aria-labelledby="ex-t">
                <p id="ex-t" className={s.exHead}><span>표준견적서 예시</span></p>
                <ul className={`${s.exList} mj-num`}>
                  <li>
                    <span className={s.exN}>벽 도배 시공 <span className="mj-small">198.4㎡</span></span>
                    <span className={s.exA}>1,189,011원</span>
                    <span className={`mj-st mj-st-ok ${s.exS}`}><OkIcon />합계에 들어가요</span>
                  </li>
                  <li>
                    <span className={s.exN}>기존 벽지 철거</span>
                    <span className={s.exA}><Dash sr="금액은 실측 뒤" /></span>
                    <span className={`mj-st mj-st-wait ${s.exS}`}><WaitIcon />실측 뒤 업체가 정해요</span>
                  </li>
                  <li>
                    <span className={s.exN}>폐기물 처리</span>
                    <span className={s.exA}><Dash sr="금액은 실측 뒤" /></span>
                    <span className={`mj-st mj-st-wait ${s.exS}`}><WaitIcon />실측 뒤 업체가 정해요</span>
                  </li>
                </ul>
              </figure>
            </div>
          </div>
        </section>

        <section className="mj-wrap" aria-labelledby="s3">
          <div className="mj-sec">
            <div className="mj-sec-l">
              <p className="mj-code">03</p>
              <h2 id="s3" className="mj-h2">공사 전에 많이 묻는 질문</h2>
            </div>
            <div className="mj-sec-c">
              <div className={s.fq}>
                {preview.map((it, i) => (
                  <details key={it.id} open={i === 0}>
                    <summary><span>{it.q}</span><span className={s.tg}><span className={s.chip}>{it.tag}</span><ChevDown /></span></summary>
                    <PreviewAnswer it={it} />
                  </details>
                ))}
                <Link className={s.fqMore} href="/faq">
                  <span>질문 모두 보기 <span className="mj-num">({faqCount}개)</span></span>
                  <span className={s.tg}><ChevRight /></span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <VendorBand />
    </>
  );
}
