// 확정한 업체 연락처 줄 (시안 WSchedule '업체 연락처'). 연락처는 실측 요청 목록(GET visits)이 공개 규칙대로 준 것만 보인다.
// 업체가 공사를 끝냈다고 올렸으면 연락처 기한(확정의 contact_until, API 값)을 보인다.
import { CopyButton } from "@/components/vendors/CopyButton";
import { WayIcon } from "@/components/vendors/icons";
import { callHours, telDigits } from "@/components/vendors/text";
import type { Schemas } from "@/lib/backend/client";
import { phoneText, tradeLabel } from "@/lib/labels";
import { untilDay } from "./text";
import s from "./schedule.module.css";

type Contact = Schemas["ContactOut"];

export function ContactStrip({ trade, vendorName, ct, until }: { trade: string; vendorName: string; ct: Contact; until?: string | null }) {
  const tel = telDigits(ct.phone);
  const hours = callHours(ct.call_start, ct.call_end);
  return (
    <section aria-labelledby="ct-h" className={s.contact}>
      <h2 id="ct-h" className={s.ctH}>업체 연락처 <span className={`mj-num ${s.ctSub}`}>· {until ? `${untilDay(until)}까지 보여요` : "공사가 끝난 날부터 1년까지 보여요"}</span></h2>
      <div className={`mj-num ${s.ctRow}`}>
        <p className={s.ctTrade}>{tradeLabel(trade)}</p>
        <p className={s.ctMain}>
          {vendorName}{ct.owner_name ? ` · 대표 ${ct.owner_name}` : ""}
          {ct.phone ? <> · <b className={s.phone}>{phoneText(ct.phone)}</b></> : null}
          {hours ? <span className="mj-small"> · 통화 가능 {hours}</span> : null}
        </p>
        {ct.phone ? (
          <div className={s.ctActs}>
            <CopyButton text={ct.phone} label="번호 복사" aria={`${vendorName} 번호 복사`} />
            {tel ? <a className="mj-btn mj-btn-sec" href={`tel:${tel}`} aria-label={`${vendorName}에 전화 걸기`}><WayIcon method="phone" />전화 걸기</a> : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
