// 보낸 견적서 한 버전 (시안 WVQuote '보낸 견적서 보기 · 읽기만 돼요'). 보내기 전 확인 창에서도 같은 모양으로 쓴다.
// 금액은 API가 계산한 total만 보이고, 업체가 넣은 금액 · 방식은 아래 한 줄로 덧붙인다.
import { fileKind } from "@/components/pro/profile/text";
import { fileSize, md, stampSeoul, won } from "@/lib/format";
import { enteredText, totalTail, type Version } from "./text";
import s from "./quote.module.css";

export const DocIcon = () => (
  <svg width="28" height="34" viewBox="0 0 28 34" fill="none" aria-hidden="true" className={s.doc}><path d="M2 1.5h16l8 8v23H2z" fill="var(--bg)" stroke="var(--line-strong)" strokeWidth="1.5" strokeLinejoin="round" /><path d="M18 1.5v8h8" stroke="var(--line-strong)" strokeWidth="1.5" strokeLinejoin="round" /><path d="M7 17h14M7 22h14M7 27h9" stroke="var(--line-paper)" strokeWidth="1.5" /></svg>
);

/** 파일 열기 주소: 보낸 버전은 이 요청의 견적서 파일 주소, 임시 저장본은 올린 파일 주소 */
const ownFile = (id: string) => `/api/files/${id}`;

export function SentQuote({ q, label, fileHref = ownFile }: { q: Version; label: string; fileHref?: (fileId: string) => string }) {
  const files = [...q.files].sort((a, b) => a.sort - b.sort);
  const entered = enteredText(q);
  return (
    <div className={s.cg}>
      <ul className={s.files} aria-label={`${label} 파일 ${files.length}개`}>
        {files.map((f) => (
          <li key={f.file_id} className={s.fl}>
            <DocIcon />
            <span className={s.fileName}>
              <b>{f.filename}</b>
              <span className="mj-small mj-num">{fileKind(f.content_type)} · {fileSize(f.size)}</span>
            </span>
            <a className="mj-btn mj-btn-sec mj-btn-sm" href={fileHref(f.file_id)} target="_blank" rel="noopener" aria-label={`${f.filename} 열기, 새 창`}>파일 열기</a>
          </li>
        ))}
      </ul>
      <dl className={`mj-num ${s.sum}`}>
        <div><dt>실측한 날</dt><dd>{q.measured_on ? md(q.measured_on) : "적지 않음"}</dd></div>
        <div>
          <dt>낼 금액</dt>
          <dd className={s.r}>
            {q.total != null ? <><span className={s.big}>{won(q.total)}</span> <span className="mj-small">{totalTail(q.vat_mode)}</span></> : "—"}
            {entered ? <span className={`mj-small ${s.block}`}>{entered}</span> : null}
          </dd>
        </div>
        <div><dt>공사 기간</dt><dd>{q.days ? `${q.days}일` : "적지 않음"}</dd></div>
        <div><dt>견적 유효기간</dt><dd>{q.valid_until ? `${md(q.valid_until)}까지` : "적지 않음"}</dd></div>
      </dl>
    </div>
  );
}

/** 보낸 버전 목록 (최신 먼저): 버전 · 보낸 날 · 금액. 고객에게는 맨 위 버전만 보인다 */
export function Versions({ sent }: { sent: Version[] }) {
  return (
    <section aria-labelledby="qv-t" className={s.vers}>
      <h2 id="qv-t" className="mj-h3">보낸 버전 <span className={`mj-num ${s.light}`}>{sent.length}개</span></h2>
      <ol className={`mj-num ${s.verList}`}>
        {sent.map((q, i) => (
          <li key={q.id}>
            <b className={s.verNo}>버전 {q.version}</b>
            <span className={s.verWhen}>{q.sent_at ? `${stampSeoul(new Date(q.sent_at))} 보냄` : ""}</span>
            <span className={s.verAmt}>{q.total != null ? <>{won(q.total)} <span className="mj-small">{totalTail(q.vat_mode)}</span></> : "—"}</span>
            <span className="mj-small">{i === 0 ? "고객에게 보여요" : "기록으로 남아요"}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
