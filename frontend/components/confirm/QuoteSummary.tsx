// 확정할(확정한) 견적서 한 장 (시안 WConfirm '확정할 견적서'). 업체가 보낸 최신 견적서의 받은 때 · 파일 · 낼 금액 · 칸.
// 숫자는 모두 API 값이고, 공급가 · 부가세는 이 합계 칸에서만 나눠 보인다. 업체가 비워 둔 칸은 보이지 않는다.
import { Thumb } from "@/components/compare/Thumb";
import { KIND_LABEL, changedText, kindOf, vsPct, type Row } from "@/components/compare/text";
import { won, wonFull } from "@/lib/format";
import { day, when } from "./text";
import s from "./confirm.module.css";

type Props = { r: Row; projectId: string; standardTotal: number; title: string };

export function QuoteSummary({ r, projectId, standardTotal, title }: Props) {
  const q = r.latest;
  if (!q) return null;
  const files = [...q.files].sort((a, b) => a.sort - b.sort);
  const fileUrl = (fileId: string) => `/api/projects/${projectId}/quotes/${q.id}/files/${fileId}`;
  const vs = vsPct(r.vs_standard, r.vs_direction);
  const exempt = q.vat_mode === "exempt";
  return (
    <section aria-labelledby="q-h" className={s.qSec}>
      <h2 id="q-h" className="mj-h2">{title}</h2>
      <div className={s.fcard}>
        <p className="mj-small mj-num">{when(q.sent_at)} 받음</p>
        {r.history.length ? (
          <p className={`mj-small ${s.re}`}>
            <span className={s.reChip}>다시 올렸어요</span>
            {r.changed.length ? `바뀐 칸 · ${changedText(r.changed)}` : "바뀐 칸은 없고 파일을 새로 올렸어요"}
          </p>
        ) : null}

        <ul className={s.files} aria-label={`견적서 파일 ${files.length}개`}>
          {files.map((f) => (
            <li key={f.file_id} className={s.qf}>
              <Thumb f={f} href={fileUrl(f.file_id)} />
              <div className={s.fm}>
                <p className={s.fn}>{f.filename}</p>
                <p className="mj-small">{KIND_LABEL[kindOf(f.content_type)]}</p>
                <div className={s.fbt}>
                  <a className="mj-btn mj-btn-sec mj-btn-sm" href={fileUrl(f.file_id)} target="_blank" rel="noopener">파일 열기<span className="mj-sr"> · {f.filename}, 새 창</span></a>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className={s.sum} role="group" aria-label="견적서 합계">
          <p className="mj-label">낼 금액</p>
          <p id="c-amt" className="mj-num"><span className={s.big}>{q.total != null ? won(q.total) : "—"}</span>{exempt ? <> <span className="mj-small">면세</span></> : null}</p>
          {exempt ? <p className="mj-small">면세라 부가세가 없어요</p> : q.supply != null && q.vat != null ? (
            <p className="mj-small mj-num">공급가 {wonFull(q.supply)} · 부가세 {wonFull(q.vat)}</p>
          ) : null}
        </div>

        <dl className={`mj-num ${s.qd}`}>
          <dt>표준견적서</dt><dd>{won(standardTotal)}</dd>
          {vs ? <><dt>표준견적서보다</dt><dd className={s.b}>{vs}</dd></> : null}
          {q.days ? <><dt>공사 기간</dt><dd>{q.days}일</dd></> : null}
          {q.valid_until ? (
            <><dt>유효기간</dt><dd>{day(q.valid_until)}까지{r.expired ? <> <span className="mj-st mj-st-bad">지났어요</span></> : null}</dd></>
          ) : null}
          {q.measured_on ? <><dt>실측한 날</dt><dd>{day(q.measured_on)}</dd></> : null}
        </dl>
      </div>
    </section>
  );
}
