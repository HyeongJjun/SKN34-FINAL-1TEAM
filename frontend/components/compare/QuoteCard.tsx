// 업체 한 곳의 실측 견적서 열 (시안 WCompare .qc). 보낸 최신 버전의 파일 · 낼 금액 · 칸, 다시 올렸으면 바뀐 칸과 지난 견적서.
// 견적서를 기다리는 업체는 '견적서 기다림' 열. 숫자는 모두 API 값이고, 공급가 · 부가세는 견적서 합계 칸에서만 나눠 보인다.
// 업체가 비워 둔 칸(공사 기간 · 유효기간 · 실측한 날)과 없는 가견적은 보이지 않는다. 확정 전 견적서 옴이면 '이 업체로 확정하기'(확정 화면). 확정 안내 · 공사 날짜 보기는 목록 위 한 곳에만 둔다.
import Link from "next/link";
import { won, wonFull } from "@/lib/format";
import { Thumb } from "./Thumb";
import { KIND_LABEL, changedText, day, kindOf, totalTail, vsPct, when, type Row } from "./text";
import s from "./Compare.module.css";

const Clock = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="7" cy="7" r="5.5" /><path d="M7 4v3.2l2 1.3" /></svg>
);

type Props = { r: Row; projectId: string; trade: string; confirmHref?: string | null };

export function QuoteCard({ r, projectId, trade, confirmHref }: Props) {
  const name = r.vendor_name;
  const detail = r.vendor_id ? `/projects/${projectId}/vendors/${r.vendor_id}?trade=${trade}` : null;
  const est = r.estimate_total != null
    ? <><span className="mj-num">{won(r.estimate_total)}</span> <span className="mj-small">부가세 포함 · 요청 때</span></>
    : null;
  const head = <h3 className="mj-h3">{detail ? <Link className={s.vn} href={detail} aria-label={`${name} 업체 자세히 보기`}>{name}</Link> : name}</h3>;

  const q = r.latest;
  if (!q) {
    return (
      <li className={`${s.card} ${s.wait}`}>
        {head}
        <p className="mj-st mj-st-wait"><Clock />견적서 기다림</p>
        <dl className={`mj-num ${s.qd}`}>
          <dt>실측 요청</dt><dd>{when(r.requested_at)}</dd>
          {est ? <><dt>가견적</dt><dd>{est}</dd></> : null}
        </dl>
        <p className="mj-small">견적서가 오면 알림으로 알려 드려요.</p>
      </li>
    );
  }

  const files = [...q.files].sort((a, b) => a.sort - b.sort);
  const fileUrl = (fileId: string) => `/api/projects/${projectId}/quotes/${q.id}/files/${fileId}`;
  const prev = r.history[0];
  const vs = vsPct(r.vs_standard, r.vs_direction);
  const exempt = q.vat_mode === "exempt";

  return (
    <li className={s.card}>
      <div className={s.cardTop}>
        {head}
        <p className="mj-small mj-num">{when(q.sent_at)} 받음</p>
      </div>

      {prev ? (
        <div className={s.re}>
          <p className={`mj-num ${s.reChip}`}>다시 올렸어요 · {when(q.sent_at)}</p>
          <p className="mj-small">{r.changed.length ? <>바뀐 칸 · {changedText(r.changed)}</> : "바뀐 칸은 없고 파일을 새로 올렸어요"}</p>
        </div>
      ) : null}

      <ul className={s.files} aria-label={`${name} 견적서 파일 ${files.length}개`}>
        {files.map((f) => (
          <li key={f.file_id} className={s.qf}>
            <Thumb f={f} href={fileUrl(f.file_id)} />
            <div className={s.fm}>
              <p className={s.fn}>{f.filename}</p>
              <p className="mj-small">{KIND_LABEL[kindOf(f.content_type)]}</p>
              <div className={s.fbt}>
                <a className="mj-btn mj-btn-sec mj-btn-sm" href={fileUrl(f.file_id)} target="_blank" rel="noopener">파일 열기<span className="mj-sr"> · {f.filename}, 새 창</span></a>
                <a className="mj-btn mj-btn-sec mj-btn-sm" href={fileUrl(f.file_id)} download={f.filename}>내려받기<span className="mj-sr"> · {f.filename}</span></a>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className={s.sum} role="group" aria-label={`${name} 견적서 합계`}>
        <p className="mj-label">낼 금액</p>
        <p className="mj-num"><span className={s.big}>{q.total != null ? won(q.total) : "—"}</span> <span className="mj-small">{totalTail(q.vat_mode)}</span></p>
        {exempt ? <p className="mj-small">면세라 부가세가 없어요</p> : q.supply != null && q.vat != null ? (
          <p className="mj-small mj-num">공급가 {wonFull(q.supply)} · 부가세 {wonFull(q.vat)}</p>
        ) : null}
        {prev && r.changed.includes("total") ? <p className="mj-small mj-num">{r.history.length === 1 ? "처음 받은 견적서" : "앞 견적서"} {won(prev.total)}</p> : null}
      </div>

      <dl className={`mj-num ${s.qd}`}>
        {vs ? <><dt>표준견적서보다</dt><dd className={s.b}>{vs}</dd></> : null}
        {est ? <><dt>가견적</dt><dd>{est}</dd></> : null}
        {q.days ? <><dt>공사 기간</dt><dd>{q.days}일</dd></> : null}
        {q.valid_until ? (
          <><dt>유효기간</dt><dd>{day(q.valid_until)}까지{r.expired ? <> <span className="mj-st mj-st-bad">지났어요</span></> : null}</dd></>
        ) : null}
        {q.measured_on ? <><dt>실측한 날</dt><dd>{day(q.measured_on)}</dd></> : null}
      </dl>

      {r.history.length ? (
        <details className={s.past}>
          <summary>{r.history.length === 1 ? "처음 받은 견적서 보기" : <>지난 견적서 <span className="mj-num">{r.history.length}개</span></>}</summary>
          <ol className={`mj-num ${s.pastList}`}>
            {r.history.map((h) => (
              <li key={h.version}>
                {[`${when(h.sent_at)} 받음`, won(h.total), h.days ? `${h.days}일` : null, h.valid_until ? `${day(h.valid_until)}까지` : null, `파일 ${h.file_count}개`].filter(Boolean).join(" · ")}
              </li>
            ))}
          </ol>
        </details>
      ) : null}

      {confirmHref ? <Link className={`mj-btn mj-btn-sec ${s.go}`} href={confirmHref}>이 업체로 확정하기<span className="mj-sr"> · {name}</span></Link> : null}
    </li>
  );
}
