// 내 공사 화면 위 이동 경로: 내 공사 › 지역 · 공정 › 화면 이름 (시안 WStandard · WPlan)
import Link from "next/link";
import s from "./ProjectCrumb.module.css";

export function ProjectCrumb({ id, title, here }: { id: string; title: string; here: string }) {
  return (
    <nav className={`mj-wrap mj-crumb ${s.crumb}`} aria-label="이동 경로">
      <ol>
        <li><Link href="/my">내 공사</Link><span aria-hidden="true">›</span></li>
        <li><Link href={`/projects/${id}`}>{title}</Link><span aria-hidden="true">›</span></li>
        <li><span aria-current="page">{here}</span></li>
      </ol>
    </nav>
  );
}
