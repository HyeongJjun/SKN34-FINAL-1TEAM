// 확정 공정표 아래 업체 연락처 (시안 WPlanDone '업체 연락처'): 공정마다 확정한 업체 · 대표 · 번호 · 복사 · 전화 걸기.
// 연락처는 실측 요청 목록(GET visits)이 공개 규칙대로 준 것만 받는다. 없으면 이 칸을 그리지 않는다.
// 업체가 공사를 끝냈다고 올렸으면 연락처 기한(확정의 contact_until, API 값)을 줄마다 보인다.
import { CopyButton } from "@/components/vendors/CopyButton";
import { WayIcon } from "@/components/vendors/icons";
import { untilDay } from "@/components/schedule/text";
import { telDigits } from "@/components/vendors/text";
import type { Schemas } from "@/lib/backend/client";
import { phoneText, tradeLabel } from "@/lib/labels";
import s from "./plan.module.css";

export type PlanContact = { trade: string; vendorName: string; ct: Schemas["ContactOut"]; until?: string | null };

export function PlanContacts({ rows }: { rows: PlanContact[] }) {
  const shown = rows.filter((r) => r.ct.phone);
  if (!shown.length) return null;
  return (
    <section aria-labelledby="pc-h" className={s.contacts}>
      <h2 id="pc-h" className={s.ctH}>업체 연락처</h2>
      <ul className={`mj-num ${s.ctList}`}>
        {shown.map(({ trade, vendorName, ct, until }) => {
          const tel = telDigits(ct.phone);
          return (
            <li key={trade}>
              <p className={s.ctTrade}>{tradeLabel(trade)}</p>
              <p className={s.ctMain}>{vendorName}{ct.owner_name ? ` · 대표 ${ct.owner_name}` : ""}<br /><b className={s.phone}>{phoneText(ct.phone ?? "")}</b>{until ? <span className={s.ctUntil}>{untilDay(until)}까지 보여요</span> : null}</p>
              <div className={s.ctActs}>
                <CopyButton text={ct.phone ?? ""} label="번호 복사" aria={`${vendorName} 번호 복사`} />
                {tel ? <a className="mj-btn mj-btn-sec" href={`tel:${tel}`} aria-label={`${vendorName}에 전화 걸기`}><WayIcon method="phone" />전화 걸기</a> : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
