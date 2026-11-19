import { Members } from "@/components/admin/Members";
import { Main, PageHead } from "@/components/site/Frame";
import { adminGate, listMembers } from "@/lib/api/admin";

export const metadata = { title: "회원 관리" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// 회원 관리(A03 a_members): 찾기(?q=) · 계정 상태(?status=) · 계정 정지 · 정지 풀기. CF-47: 제목 옆 설명은 뺐어요.
export default async function MembersPage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; status?: string | string[] }> }) {
  await adminGate("/admin/members");
  const sp = await searchParams;
  const q = (one(sp.q) ?? "").trim().slice(0, 50);
  const st = one(sp.status);
  const status = st === "active" || st === "suspended" ? st : "all";
  const page = await listMembers(q, status === "all" ? undefined : status);
  return (
    <Main>
      <PageHead title="회원 관리" phoneTitle />
      <Members key={`${q}|${status}`} rows={page.items} q={q} status={status} />
    </Main>
  );
}
