import { redirect } from "next/navigation";
import { vendorGate } from "@/lib/api/vendor";

// 예전 주소. 확정된 공사는 작업함 공사 탭에 모여 있어 그리로 보내요. 한 공사는 /vendor/jobs/{deal_id}.
export default async function VendorJobs() {
  await vendorGate("/vendor/jobs");
  redirect("/vendor?tab=jobs");
}
