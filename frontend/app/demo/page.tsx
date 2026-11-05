// 시연 순서: 고객 흐름(견적 받기 → 확정 공정표)을 단계마다 미리 준비한 공사로 잇는 안내 화면. 메뉴에는 없다.
// 시연 데이터는 backend app/demo.py가 만든다. 단계마다 '지금 할 일'이 그 단계인 가장 최근 공사를 쓴다.
import Link from "next/link";
import { SiteHeader } from "@/components/site/SiteHeader";
import { listMyProjects, type ApiProjectItem } from "@/lib/api/project";
import { DEMO_EMAIL } from "@/lib/demo";
import { getSession } from "@/lib/session";
import s from "./page.module.css";

export const metadata = { title: "시연 순서", robots: { index: false } };

type Step = { code: string; title: string; desc: string; go: string };

// 1단계(견적 받기)는 업체 고르기 전 공사의 표준견적서 · 예상 공정표를 함께 보여 준다
const STEPS: Step[] = [
  { code: "pick", title: "업체 고르기", desc: "업체마다 가견적을 보고 3곳까지 담아 실측을 요청해요.", go: "업체 고르기" },
  { code: "visit_requested", title: "실측 요청", desc: "요청한 업체와 업체가 정한 연락 방법이 보여요. 방문 날짜는 업체와 직접 정해요.", go: "실측 요청 보기" },
  { code: "quotes_arrived", title: "견적서 비교 · 업체 확정", desc: "업체가 올린 실측 견적서를 표준견적서와 비교하고 한 곳을 확정해요.", go: "견적서 비교" },
  { code: "dates_received", title: "공사 날짜 수락", desc: "확정한 업체가 올린 공사 날짜를 내 공정표에 얹어 보고 수락해요.", go: "공사 날짜 보기" },
  { code: "before_work", title: "확정 공정표", desc: "수락한 날짜로 공정별 일정이 하루 단위로 잡혀요. 목공 다음에 도배를 해요.", go: "확정 공정표 보기" },
];

/** 할 일이 그 단계인 가장 최근에 만든 공사 */
function latest(items: ApiProjectItem[], code: string) {
  return items.filter((p) => p.todo?.code === code).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
}

function Meta({ p }: { p?: ApiProjectItem }) {
  return p
    ? <p className="mj-small mj-num">{p.code} · {p.region}</p>
    : <p className={`mj-small ${s.none}`}>이 단계에 맞는 공사가 없어요. 시연 데이터를 다시 만들어 주세요.</p>;
}

export default async function DemoPage() {
  const session = await getSession();
  const customer = session?.role === "customer";
  const items = customer ? await listMyProjects() : [];
  const first = latest(items, "pick");

  return (
    <>
      <SiteHeader />
      <main id="main">
        <div className={`mj-wrap ${s.head}`}>
          <h1 className="mj-h1">시연 순서</h1>
          <p className="mj-sub">견적 받기부터 확정 공정표까지 고객이 보는 화면을 순서대로 열어요. 단계마다 미리 준비한 공사로 이어져요.</p>
        </div>

        <div className={`mj-wrap ${s.body}`}>
          {!customer ? (
            <section className={s.login} aria-labelledby="dm-login">
              <h2 id="dm-login" className={s.loginT}>{session ? "고객 계정으로 바꿔 로그인해 주세요" : "시연 고객 계정으로 로그인해 주세요"}</h2>
              <p className="mj-small">계정 <b className="mj-num">{DEMO_EMAIL}</b> · 비밀번호는 따로 받은 것을 써요.</p>
              {session ? (
                <p className="mj-small">지금은 {session.role === "vendor" ? "업체" : "관리자"} 계정이에요. 오른쪽 위 메뉴에서 로그아웃한 뒤 로그인해 주세요.</p>
              ) : (
                <p><Link className="mj-btn mj-btn-pri" href="/login?next=%2Fdemo">로그인</Link></p>
              )}
            </section>
          ) : null}

          <ol className={s.steps}>
            <li className={s.step}>
              <span className={s.no} aria-hidden="true">1</span>
              <div className={s.main}>
                <h2 className={s.t}><span className="mj-sr">1단계 </span>견적 받기</h2>
                <p>집 정보와 공정을 넣으면 표준견적서와 예상 공정표가 바로 나와요. 질문 화면 맨 위 &lsquo;예시 값 채우기&rsquo;로 한 번에 채울 수 있어요.</p>
                <div className={s.acts}>
                  <Link className="mj-btn mj-btn-pri" href="/start">견적 받기 시작</Link>
                  {first ? (
                    <>
                      <Link className="mj-btn mj-btn-sec" href={`/projects/${first.id}/standard`}>표준견적서 보기</Link>
                      <Link className="mj-btn mj-btn-sec" href={`/projects/${first.id}/plan`}>예상 공정표 보기</Link>
                    </>
                  ) : null}
                </div>
                {customer ? <Meta p={first} /> : null}
              </div>
            </li>
            {STEPS.map((st, i) => {
              const p = customer ? latest(items, st.code) : undefined;
              return (
                <li key={st.code} className={s.step}>
                  <span className={s.no} aria-hidden="true">{i + 2}</span>
                  <div className={s.main}>
                    <h2 className={s.t}><span className="mj-sr">{i + 2}단계 </span>{st.title}</h2>
                    <p>{st.desc}</p>
                    {p?.todo ? <div className={s.acts}><Link className="mj-btn mj-btn-pri" href={p.todo.link}>{st.go}</Link></div> : null}
                    {customer ? <Meta p={p} /> : null}
                  </div>
                </li>
              );
            })}
          </ol>

          <p className="mj-small">업체가 할 일(견적서 보내기 · 공사 날짜 내기)은 미리 해 두었어요. 한 단계에서 버튼을 누르면 그 공사는 다음 단계로 넘어가니, 다음 단계는 아래 카드의 공사로 이어서 봐요.</p>
        </div>
      </main>
    </>
  );
}
