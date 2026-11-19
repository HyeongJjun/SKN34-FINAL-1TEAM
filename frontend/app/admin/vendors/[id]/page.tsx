import { notFound, redirect } from "next/navigation";
import { adminGate, getVendorApplication } from "@/lib/api/admin";

// 예전 주소(/admin/vendors/{id})는 업체 심사 화면에서 그 신청을 연 모습으로 보내요.
export default async function AdminVendorDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await adminGate("/admin/vendors");
  const v = await getVendorApplication(id);
  if (!v) notFound();
  redirect(`/admin/vendors?id=${encodeURIComponent(v.user_id)}`);
}
