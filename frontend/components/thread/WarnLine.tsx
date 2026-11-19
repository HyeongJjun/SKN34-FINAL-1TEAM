// 믿집 밖 거래 주의 줄(C62 · D05 A): 업체 글이 규칙 낱말에 걸리면(warn = 'offsite') 고객 화면에만 그 글 아래 한 줄.
// 글은 9판 그대로 한 줄만(U8 · 안내 글 · 신고 링크는 뺐어요). 막지 않고 알리기만 해요.
import s from "./thread.module.css";

export const WARN_TEXT = "믿집 밖 계약 · 계좌 · 현금 선불을 권하면 조심하세요.";

export function WarnLine() {
  return <p className={s.warn} role="note">{WARN_TEXT}</p>;
}
