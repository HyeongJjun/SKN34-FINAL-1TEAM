import Link from "next/link";
import { SiteHeader } from "@/components/site/SiteHeader";
import { DraftCard } from "@/components/my/DraftCard";
import { ProjectList } from "@/components/my/ProjectList";
import { listMyProjects } from "@/lib/api/project";
import { requireRole } from "@/lib/session";
import s from "@/components/my/my.module.css";

export const metadata = { title: "내 공사" };

// 내 공사 목록 (시안 WMy · 3안). 서버가 바뀐 날 최근 순으로 준 공사를 카드 하나씩 보여 준다.
// 쓰던 요청서(브라우저 저장)가 있으면 목록 위에 카드로 보인다.
export default async function MyPage() {
  await requireRole("customer", "/my");
  const mine = await listMyProjects();
  return (
    <>
      <SiteHeader />
      <main id="main">
        <div className={`mj-wrap ${s.head}`}>
          <div className={s.title}>
            <h1 className="mj-h1">내 공사</h1>
            {mine.length ? <p className="mj-sub mj-num">{mine.length}건 · 최근에 바뀐 순서</p> : null}
          </div>
          <Link className="mj-btn mj-btn-sec" href="/start">새 견적 받기</Link>
        </div>

        <div className={`mj-wrap ${s.draft}`}><DraftCard /></div>

        <section className={`mj-wrap ${s.list}`} aria-labelledby="list-t">
          {mine.length ? (
            <>
              <h2 id="list-t" className="mj-sr">공사 목록</h2>
              <ProjectList items={mine} />
            </>
          ) : (
            <div className={s.empty}>
              <h2 id="list-t" className={s.emptyT}>아직 만든 공사가 없어요</h2>
              <p className="mj-small">집 정보와 공정을 넣으면 표준견적서와 예상 공정표를 받아요.</p>
              <p className={s.emptyA}><Link className="mj-btn mj-btn-pri" href="/start">견적 받기 시작</Link></p>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
