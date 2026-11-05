import { notFound, redirect } from "next/navigation";
import { getVendorApplication } from "@/lib/api/admin";

// 예전 주소(/admin/vendors/{id})는 업체 심사 화면에서 그 신청을 연 모습으로 보낸다.
export default async function AdminVendorDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await getVendorApplication(id);
  if (!v) notFound();
  const tab = v.status === "pending" ? "pending" : v.status === "needs_info" ? "needs_info" : "done";
  redirect(`/admin/vendors?tab=${tab}&id=${v.user_id}`);
}
