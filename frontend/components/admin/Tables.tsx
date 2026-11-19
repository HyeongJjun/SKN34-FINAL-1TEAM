// 관리자 표(A01 업체 심사 · A02 신고 · 링크). 줄의 상호 칸이 링크(?id=)이고, 줄 전체를 눌러도 같은 곳으로 가요.
// 웹 전용 화면이지만 폰에서 화면이 가로로 넘치지 않게 표만 옆으로 넘겨요.
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import type { ReportRowV3, VendorApplication } from "@/lib/api/admin";
import { dateShort, listStamp } from "@/lib/format";
import { tradeLabel } from "@/lib/labels";
import { areasText, REPORT_KIND, REPORT_REASON, vendorBadge } from "./text";
import s from "./admin.module.css";

export function VendorTable({ list, cur, hrefOf }: { list: VendorApplication[]; cur?: string; hrefOf: (id: string) => string }) {
  return (
    <div className={s.tableBox} tabIndex={0} role="region" aria-label="업체 심사 목록 · 옆으로 넘겨 볼 수 있어요">
      <table className={s.table}>
        <caption className="mj-sr">업체 가입 신청. 줄을 고르면 오른쪽에 자세히가 열려요</caption>
        {/* CF-66: 신청 → 신청일 · CF-11: 공정 → 공사 */}
        <thead><tr><th scope="col">신청일</th><th scope="col">상호</th><th scope="col">공사</th><th scope="col">지역</th><th scope="col">상태</th></tr></thead>
        <tbody>
          {list.map((v) => {
            const on = v.user_id === cur;
            const b = vendorBadge(v.status);
            return (
              <tr key={v.user_id} className={on ? s.sel : undefined}>
                <td className="mj-num">{dateShort(v.submitted_at ?? v.created_at)}</td>
                <td className={s.name}><Link href={hrefOf(v.user_id)} aria-current={on ? "true" : undefined} scroll={false}><b>{v.biz_name ?? v.name}</b></Link></td>
                <td>{v.trades.map(tradeLabel).join(" · ")}</td>
                <td>{areasText(v.areas)}</td>
                <td><Badge tone={b.tone}>{b.label}</Badge></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ReportTable({ list, cur, hrefOf }: { list: ReportRowV3[]; cur?: string; hrefOf: (id: string) => string }) {
  return (
    <div className={s.tableBox} tabIndex={0} role="region" aria-label="신고 목록 · 옆으로 넘겨 볼 수 있어요">
      <table className={s.table}>
        <caption className="mj-sr">신고 · 링크. 줄을 고르면 오른쪽에 자세히가 열려요</caption>
        <thead><tr><th scope="col">받은 때</th><th scope="col">종류</th><th scope="col">대상</th><th scope="col">이유</th><th scope="col">상태</th></tr></thead>
        <tbody>
          {list.map((r) => {
            const on = r.id === cur;
            return (
              <tr key={r.id} className={on ? s.sel : undefined}>
                <td className="mj-num">{listStamp(r.created_at)}</td>
                <td>{REPORT_KIND[r.kind] ?? "그 밖"}</td>
                <td className={s.name}>
                  <Link href={hrefOf(r.id)} aria-current={on ? "true" : undefined} scroll={false}><b>{r.vendor_name ?? "업체"}</b></Link>
                  {r.kind === "link" ? <span className={s.sub}>외부 리뷰 링크</span> : null}
                </td>
                <td>{REPORT_REASON[r.reason_code] ?? "그 밖"}</td>
                <td><Badge tone={r.status === "open" ? "wait" : "mute"}>{r.status === "open" ? "처리 기다림" : "처리함"}</Badge></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
