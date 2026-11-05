import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Wizard } from "@/components/start/Wizard";
import { getMyProject, listRegions } from "@/lib/api/project";
import { isDemo } from "@/lib/demo";
import { getSession, requireRole } from "@/lib/session";
import { todaySeoul } from "@/lib/format";

export const metadata = { title: "견적 받기" };

// 견적 받기 (시안 WWizard). ?edit={id}면 그 프로젝트의 집 정보를 고친다(만든 고객만, 남의 것은 404).
export default async function StartPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { edit } = await searchParams;
  const project = edit ? await editTarget(edit) : null;
  const [session, regions] = await Promise.all([getSession(), listRegions()]);
  return (
    <>
      <SiteHeader />
      <Wizard key={project?.id ?? "new"} regions={regions} today={todaySeoul()} role={session?.role ?? null} project={project} demo={!project && isDemo(session)} />
    </>
  );
}

async function editTarget(id: string) {
  await requireRole("customer", `/start?edit=${encodeURIComponent(id)}`);
  const p = await getMyProject(id);
  if (!p) notFound();
  return p;
}
