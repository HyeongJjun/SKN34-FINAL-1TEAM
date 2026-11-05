import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site/SiteHeader";
import { getMyProject } from "@/lib/api/project";
import { requireRole } from "@/lib/session";

// 내 공사 한 건. 고객만 보고, 없거나 남의 프로젝트면 404. 이동 경로는 화면마다 그린다(components/project/ProjectCrumb).
export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRole("customer", `/projects/${id}`);
  if (!(await getMyProject(id))) notFound();
  return (
    <>
      <SiteHeader />
      {children}
    </>
  );
}
