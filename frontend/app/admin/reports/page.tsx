import { ReportDetail } from "@/components/admin/ReportDetail";
import { ReportTable } from "@/components/admin/Tables";
import s from "@/components/admin/admin.module.css";
import { Main } from "@/components/site/Frame";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tabs } from "@/components/ui/Tabs";
import { adminGate, getReport, listReports, type ReportKind, type ReportStatus } from "@/lib/api/admin";

export const metadata = { title: "신고 · 링크" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const KINDS: { key: ReportKind | "all"; text: string }[] = [
  { key: "all", text: "전체" },
  { key: "chat", text: "채팅" },
  { key: "vendor", text: "업체" },
  { key: "link", text: "링크" },
];

// 신고 · 링크 처리(A02 a_report): [처리 기다림 n · 처리함] + [전체 · 채팅 · 업체 · 링크] 거르기, 표 + 오른쪽 자세히(?id=).
export default async function AdminReports({ searchParams }: { searchParams: Promise<{ status?: string | string[]; kind?: string | string[]; id?: string | string[] }> }) {
  await adminGate("/admin/reports");
  const sp = await searchParams;
  const status: ReportStatus = one(sp.status) === "done" ? "done" : "open";
  const kindQ = one(sp.kind);
  const kind = KINDS.find((k) => k.key === kindQ && k.key !== "all")?.key as ReportKind | undefined;
  const page = await listReports(status, kind);
  const curId = one(sp.id) ?? page.items[0]?.id;
  const r = curId ? await getReport(curId) : null;

  const href = (p: { status?: ReportStatus; kind?: ReportKind | "all"; id?: string }) => {
    const qs = new URLSearchParams();
    const st = p.status ?? status;
    const k = p.kind === undefined ? kind : p.kind === "all" ? undefined : p.kind;
    if (st !== "open") qs.set("status", st);
    if (k) qs.set("kind", k);
    if (p.id) qs.set("id", p.id);
    const q = qs.toString();
    return `/admin/reports${q ? `?${q}` : ""}`;
  };
  const open = page.counts.open;

  return (
    <Main>
      <h1 className="mj-sr">신고 · 링크</h1>
      <div className={s.filter}>
        <Tabs
          variant="pill"
          label="처리 상태"
          value={status}
          items={[
            { key: "open", label: "처리 기다림", count: open, href: href({ status: "open" }) },
            { key: "done", label: "처리함", href: href({ status: "done" }) },
          ]}
        />
        <Tabs variant="type" label="신고 종류" value={kind ?? "all"} items={KINDS.map((k) => ({ key: k.key, label: k.text, href: href({ kind: k.key }) }))} />
      </div>
      {page.items.length ? (
        <div className={s.split}>
          <ReportTable list={page.items} cur={r?.id} hrefOf={(id) => href({ id })} />
          {r ? <ReportDetail key={r.id} r={r} /> : <p className={s.count}>신고를 찾을 수 없어요. 표에서 다시 골라 주세요.</p>}
        </div>
      ) : (
        <EmptyState icon="box" title={status === "open" ? "처리를 기다리는 신고가 없어요" : "처리한 신고가 없어요"}>
          {status === "open" ? "고객 · 업체가 채팅 · 업체 · 링크를 신고하면 여기에 보여요." : null}
        </EmptyState>
      )}
    </Main>
  );
}
