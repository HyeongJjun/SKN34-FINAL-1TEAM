// 공사 날짜 상태 줄 (시안 WSchedule '같은 화면의 다른 모습'): 날짜 기다림 · 기한 지남 · 날짜가 바뀜 · 다른 날짜 요청함.
// 수락한 뒤(시안 WPlanDone '확정한 날짜 바꾸기'): 지금 → 새 날짜 · 날짜 바꾸기 요청함.
// 기한 · 기한 지남 · 남은 요청 수는 API 값 그대로다.
import { Clock } from "@/components/confirm/DealStatus";
import { day, when } from "@/components/confirm/text";
import { Warn } from "@/components/vendors/icons";
import { daySeoul, iGa } from "@/components/vendors/text";
import { span, type DateReq, type Proposal } from "./text";
import s from "./schedule.module.css";

const Dot = () => (
  <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="7" cy="7" r="5.5" /><circle cx="7" cy="7" r="2" fill="currentColor" /></svg>
);

/** 아직 날짜를 안 냈을 때: 기한까지 기다림 · 기한 지남 */
export function WaitLines({ vendorName, dueAt, overdue }: { vendorName: string; dueAt: string; overdue: boolean }) {
  return overdue ? (
    <div className={s.reqLines}>
      <p className={`mj-st mj-st-bad mj-num ${s.stLine} ${s.stBig}`}><Warn />기한 지남 · {when(dueAt)}까지였어요</p>
      <p>{iGa(vendorName)} 아직 공사 날짜를 내지 않았어요. 먼저 전화해 보세요. 더 기다려도 되고, 날짜가 오면 여기에 보여요.</p>
    </div>
  ) : (
    <div className={s.reqLines}>
      <p className={`mj-st mj-st-wait mj-num ${s.stLine} ${s.stBig}`}><Clock />{iGa(vendorName)} 공사 날짜를 정하고 있어요 · {when(dueAt)}까지</p>
      <p className="mj-small">통화로 날짜를 정했다면 {iGa(vendorName)} 믿집에 올리면 여기에 보여요. 날짜가 오면 알림으로 알려 드려요.</p>
    </div>
  );
}

/** 업체가 날짜를 다시 냈을 때 (API changed): 요청에 답한 것이면 '새 날짜가 왔어요' */
export function ChangedLine({ x, vendorName }: { x: Proposal; vendorName: string }) {
  if (!x.changed) return null;
  return (
    <div className={s.reqLines}>
      <p className={`mj-st mj-st-now mj-num ${s.stLine} ${s.stBig}`}><Dot />
        {x.request_id ? `새 날짜가 왔어요 · ${span(x.start, x.end)}` : `날짜가 바뀌었어요 · ${iGa(vendorName)} ${span(x.start, x.end)}로 다시 냈어요`}
      </p>
      <p className="mj-small">다시 수락해야 확정돼요.</p>
    </div>
  );
}

/** 수락한 뒤 업체가 올린 새 날짜: 지금 → 새 날짜 · 업체가 적은 이유 */
export function MoveLine({ x, vendorName, start, end }: { x: Proposal; vendorName: string; start: string; end: string }) {
  return (
    <div className={s.reqLines}>
      <p className={`mj-st mj-st-now mj-num ${s.stLine} ${s.stBig}`}><Dot />
        <span><span className={s.stSub}>지금</span> {span(start, end)} <span aria-hidden="true">→</span><span className="mj-sr">에서</span> <span className={s.stSub}>새 날짜</span> {span(x.start, x.end)}</span>
      </p>
      {x.reason ? <p className="mj-small">{iGa(vendorName)} 적은 이유 · {x.reason}</p> : null}
    </div>
  );
}

/** 수락한 뒤 날짜 바꾸기를 요청했을 때: 보낸 때 · 업체가 새 날짜를 올릴 기한 · 고른 날 · 이유 · 남은 요청 수 */
function ChangeRequestLines({ r, vendorName, left }: { r: DateReq; vendorName: string; left: number }) {
  return (
    <div className={s.reqLines}>
      {r.overdue ? (
        <>
          <p className={`mj-st mj-st-bad mj-num ${s.stLine} ${s.stBig}`}><Warn />기한 지남 · {when(r.due_at)}</p>
          <p>지금 날짜는 그대로예요. {vendorName}에 전화해 이야기해요.</p>
        </>
      ) : (
        <p className={`mj-st mj-st-wait mj-num ${s.stLine} ${s.stBig}`}><Clock />{when(r.created_at)}에 요청을 보냈어요 · {iGa(vendorName)} {when(r.due_at)}까지 새 날짜를 올려요</p>
      )}
      <p className="mj-small mj-num">고른 날 {r.wish_dates.map((w) => `${day(w)} 시작`).join(" · ")}{r.reason ? ` · 이유: ${r.reason}` : ""}</p>
      <p className="mj-small mj-num">{left > 0 ? `남은 요청 ${left}번 · ` : ""}새 날짜가 오면 내 공정표에 얹어 보고 수락해요. 그전까지 지금 날짜가 그대로예요.</p>
    </div>
  );
}

/** 다른 날짜를 요청한 뒤: 보낸 날 · 답 기한 · 고른 날 · 남은 요청 수 (after: 수락한 뒤 날짜 바꾸기 요청) */
export function RequestLines({ r, vendorName, left, after }: { r: DateReq; vendorName: string; left: number; after?: boolean }) {
  if (after) return <ChangeRequestLines r={r} vendorName={vendorName} left={left} />;
  return (
    <div className={s.reqLines}>
      {r.overdue ? (
        <p className={`mj-st mj-st-bad mj-num ${s.stLine} ${s.stBig}`}><Warn />{iGa(vendorName)} 답할 기한이 지났어요 · {when(r.due_at)}까지였어요</p>
      ) : (
        <p className={`mj-st mj-st-wait mj-num ${s.stLine} ${s.stBig}`}><Clock />{daySeoul(r.created_at)}에 요청을 보냈어요 · {vendorName} 답을 기다려요 · {when(r.due_at)}까지</p>
      )}
      <p className="mj-small mj-num">고른 날 {r.wish_dates.map((w) => `${day(w)} 시작`).join(" · ")}{r.reason ? ` · 이유: ${r.reason}` : ""}</p>
      <p className="mj-small mj-num">{left > 0 ? `남은 요청 ${left}번 · ` : ""}업체는 요청 다음 날 18:00까지 새 날짜를 내요. 그전까지 지금 날짜가 그대로이고, 이 날짜로 수락해도 돼요.</p>
    </div>
  );
}
