// 업체가 낸 공사 날짜 칸 (시안 WSchedule 위쪽 dl): 낸 날짜 · 일하는 날 · 작업 인원. 정한 방법 · 올린 때는 보이지 않는다(시안 v2 버전 33).
// 일하는 날 · 공휴일은 API 값 그대로다(공휴일은 API 목록에서 이 날짜 안의 것만 고른다).
import { day } from "@/components/confirm/text";
import { holidaysIn, offText, span, type Holiday, type Proposal } from "./text";
import s from "./schedule.module.css";

/** dateLabel: 날짜 칸 이름 (수락한 뒤 바꾸자는 날짜면 '새 날짜') */
type Props = { x: Proposal; vendorName: string; weekendWork: boolean; holidays: Holiday[]; dateLabel?: string };

export function DatesFacts({ x, weekendWork, holidays, dateLabel = "낸 날짜" }: Props) {
  const hs = holidaysIn(holidays, x.start, x.end);
  return (
    <div className={s.facts}>
      <dl className={`mj-num ${s.dl}`}>
        <div>
          <dt className="mj-small">{dateLabel}</dt>
          <dd className={s.big}>
            {span(x.start, x.end)}
            {hs.length ? <span className={s.ddSub}>{hs.map((h) => `${day(h.day)} ${h.name}`).join(", ")} 쉬어요</span> : null}
          </dd>
        </div>
        <div>
          <dt className="mj-small">일하는 날</dt>
          <dd className={s.big}>{x.workdays}일 <span className={s.ddTail}>{offText(weekendWork)}</span></dd>
        </div>
        <div>
          <dt className="mj-small">작업 인원</dt>
          <dd className={s.big}>{x.crew}명</dd>
        </div>
      </dl>
    </div>
  );
}
