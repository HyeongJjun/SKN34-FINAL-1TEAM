import { listMembers } from "@/lib/api/admin";
import { MemberTable } from "@/components/admin/MemberTable";

export const metadata = { title: "회원관리" };

export default async function MembersPage() {
  const members = await listMembers();
  return (
    <main id="main" className="mj-wrap mj-main">
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <h1 className="mj-h1">회원관리</h1>
      </div>
      <MemberTable initial={members} />
    </main>
  );
}
