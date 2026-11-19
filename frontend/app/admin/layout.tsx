import { AdminHeader } from "@/components/pro/Shell";
import { adminGate } from "@/lib/api/admin";

// 관리자 화면 틀: 관리자만(아니면 로그인 · 제 첫 화면으로). 머리 메뉴는 업체 심사 · 신고 · 링크 · 회원(9판 a_*).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await adminGate("/admin/vendors");
  return (
    <>
      <AdminHeader me={me} />
      {children}
    </>
  );
}
