// /projects/{id}/assistant — 비서 화면(시연 피드백 2026-11-20 · 11-23): 왼쪽은 재재와 대화, 오른쪽은 고칠 수 있는 '내 도배 플랜' 8단계.
// 읽기: GET /projects/{id}/overview · /quotes(비교). 대화는 POST /ai/turns(AiPanel), 현장 정보 · 준비 체크는 각 조각이 자기 API를 불러요.
// 새 서버 API는 없어요. 금액 · 날짜 · 단계는 API 값 그대로이고, 저장 · 확정은 각 화면에서 사람이 눌러요.
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/site/AppHeader";
import { LiveRefresh } from "@/components/schedule/LiveRefresh";
import { SecretaryView } from "@/components/secretary/SecretaryView";
import { getCompare, getOverview } from "@/lib/api/schedule";
import { getVisitProject } from "@/lib/api/visit";

export const metadata = { title: "재재와 진행하기" };

export default async function SecretaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [p, ov] = await Promise.all([getVisitProject(id), getOverview(id)]);
  if (!p || !ov) notFound();
  const compare = await getCompare(p.id).catch(() => null);
  return (
    <>
      <AppHeader only="phone" phone={{ title: "재재와 진행하기", back: `/projects/${encodeURIComponent(p.id)}` }} />
      <SecretaryView p={p} ov={ov} compare={compare} />
      <LiveRefresh projectId={p.id} />
    </>
  );
}
