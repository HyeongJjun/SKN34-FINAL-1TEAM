// 아래 단추 띠(design-system 3.1 BottomBar · 9판 k-cta · 웹 k-dacts).
// 폰(<768): 화면 아래에 붙어요(위 1px 줄 · 아래 안전 영역). 단추 하나는 가득, 둘은 1:1([보조 | 주]). 위에 한 줄(설명 · 고른 것 요약)을 둘 수 있어요.
// 웹(≥768): 본문 끝에서 오른쪽 정렬, 단추 최소 160(늘어나지 않게 · 작은 손질 4). 위 한 줄은 왼쪽에 와요.
// Main 바깥, Main 바로 뒤에 둬요(붙는 띠가 자기 자리를 차지해 본문을 가리지 않아요). 이 띠가 있는 화면에는 아래 탭 바를 두지 않아요.
import type { ReactNode } from "react";
import s from "./BottomBar.module.css";

export function BottomBar({ children, note, summary }: {
  /** 단추 1~2개(Button size="lg") */
  children: ReactNode;
  /** 단추 위 설명 한 줄(예: '보내면 지금 가견적이 고정되고, 기본 정보는 잠겨요') */
  note?: ReactNode;
  /** 고른 것 요약 줄(예: 마루와벽 · 12.15(화) 오전) — 왼쪽 작은 글 + 오른쪽 굵은 글 */
  summary?: { label: ReactNode; value: ReactNode };
}) {
  return (
    <div className={s.bar} data-mj-bottombar="">
      <div className={s.in}>
        {summary ? <p className={s.sum}><span>{summary.label}</span><b className="mj-num">{summary.value}</b></p> : null}
        {note ? <p className={s.note}>{note}</p> : null}
        <div className={s.btns}>{children}</div>
      </div>
    </div>
  );
}
