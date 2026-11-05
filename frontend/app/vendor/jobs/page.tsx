import { redirect } from "next/navigation";
import { requireRole } from "@/lib/session";

// 머리 메뉴 '일정'. 확정된 공사는 작업함 공사 탭에 모여 있어 그리로 보낸다. 한 공사는 /vendor/jobs/{deal_id}.
export default async function VendorJobs() {
  await requireRole("vendor", "/vendor/jobs");
  redirect("/vendor?tab=jobs");
}
