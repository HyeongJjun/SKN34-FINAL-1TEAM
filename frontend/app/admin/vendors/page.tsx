import { VendorDetail } from "@/components/admin/VendorDetail";
import { VendorTable } from "@/components/admin/Tables";
import s from "@/components/admin/admin.module.css";
import { Main } from "@/components/site/Frame";
import { EmptyState } from "@/components/ui/EmptyState";
import { adminGate, getVendorApplication, listVendorApplications } from "@/lib/api/admin";

export const metadata = { title: "업체 심사" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// 업체 심사(A01 a_review · A04 a_reject): 왼쪽 신청 표 + 오른쪽 고른 신청 자세히(?id=). 9판처럼 거르기 없이 한 표에 보여요.
// 처음에는 심사 기다림 첫 줄(없으면 첫 줄)을 열어요.
export default async function AdminVendors({ searchParams }: { searchParams: Promise<{ id?: string | string[] }> }) {
  await adminGate("/admin/vendors");
  const want = one((await searchParams).id);
  const list = await listVendorApplications("all");
  const curId = want ?? (list.find((x) => x.status === "pending") ?? list[0])?.user_id;
  const v = curId ? await getVendorApplication(curId) : null;
  const hrefOf = (id: string) => `/admin/vendors?id=${encodeURIComponent(id)}`;

  return (
    <Main>
      <h1 className="mj-sr">업체 심사</h1>
      {list.length ? (
        <div className={s.split}>
          <VendorTable list={list} cur={v?.user_id} hrefOf={hrefOf} />
          {v ? <VendorDetail key={v.user_id} v={v} /> : <p className={s.count}>신청을 찾을 수 없어요. 표에서 다시 골라 주세요.</p>}
        </div>
      ) : (
        <EmptyState icon="box" title="업체 가입 신청이 없어요">업체가 가입을 신청하면 여기에 보여요.</EmptyState>
      )}
    </Main>
  );
}
