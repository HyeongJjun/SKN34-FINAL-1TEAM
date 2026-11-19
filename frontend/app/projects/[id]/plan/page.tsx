// /projects/{id}/plan — 공정표. 수락한 공사 날짜가 있으면 확정 공정표(C36 폰 · D19 웹), 없으면 예상 공정표(C08).
// 날짜 · 일수 · 인원 · 금액은 모두 API(계산 엔진) 값이에요. 화면은 나누거나 올리지 않아요.
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/site/AppHeader";
import { Main, PageHead, WithAside } from "@/components/site/Frame";
import { ExpectedPlan } from "@/components/plan/ExpectedPlan";
import { FinalPlanAside, FinalPlanBody, finalHead } from "@/components/plan/FinalPlanView";
import { Badge } from "@/components/ui/Badge";
import { BottomBar } from "@/components/ui/BottomBar";
import { Button } from "@/components/ui/Button";
import { HelpTip } from "@/components/ui/HelpTip";
import { getChecks, getPlanView, getProjectShell } from "@/lib/api/project";

export const metadata = { title: "공정표" };

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const shell = await getProjectShell(id);
  if (!shell) notFound();
  const plan = await getPlanView(shell.id);
  if (!plan) notFound();
  const base = `/projects/${shell.id}`;
  const crumbs = (here: string) => [{ label: "내 공사", href: "/my" }, { label: shell.name, href: base }, { label: here }];

  if (plan.kind === "final") {
    const checks = await getChecks(shell.id);
    const h = finalHead(plan);
    return (
      <>
        <AppHeader only="phone" phone={{ title: "확정 공정표", back: base }} />
        <Main>
          <PageHead title="확정 공정표" crumbs={crumbs("확정 공정표")} desc={<span className="mj-num">{h.made}</span>} badge={<Badge tone="ok">{h.badge}</Badge>} />
          <WithAside label="공사 전 할 일" aside={<FinalPlanAside plan={plan} projectId={shell.id} checks={checks} mock={shell.mock} />}>
            <FinalPlanBody plan={plan} projectId={shell.id} checks={checks} mock={shell.mock} />
          </WithAside>
        </Main>
      </>
    );
  }

  return (
    <>
      <AppHeader only="phone" phone={{ title: "예상 공정표", back: `${base}/standard` }} />
      <Main narrow>
        <PageHead title="예상 공정표" crumbs={crumbs("예상 공정표")}
          badge={<HelpTip only="web" label="확정 공정표 안내">확정 공정표는 업체를 확정하고 공사 날짜를 수락하면 만들어져요.</HelpTip>} />
        <ExpectedPlan plan={plan} />
      </Main>
      <BottomBar>
        <Button size="lg" href={`${base}/vendors`}>업체 보기</Button>
      </BottomBar>
    </>
  );
}
