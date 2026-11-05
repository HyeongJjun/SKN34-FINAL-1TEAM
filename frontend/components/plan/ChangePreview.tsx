// 새 날짜로 바꾸면 밀리는 공정표 미리 보기 (시안 WPlanDone '새 날짜를 얹어 본 공정표'): API가 바꾼 뒤 모습으로 준 blocks · days 그대로.
// 넓은 화면은 막대(바꾸는 공정은 지금 · 새 날짜 두 줄), 좁은 화면은 같은 내용을 목록으로 보인다.
import { Fragment } from "react";
import { span } from "@/components/schedule/text";
import { tradeLabel } from "@/lib/labels";
import { StateBars, StateLegend } from "./StateBars";
import { blockSub, changeRows, STATE_TEXT, type Day, type PlanChange } from "./text";
import s from "./plan.module.css";

export function ChangePreview({ c, now }: { c: PlanChange; now: Day[] }) {
  const rows = changeRows(c, now);
  const tName = tradeLabel(c.trade);
  return (
    <div className={s.preview}>
      <div className={s.previewBars}>
        <StateBars days={c.days} rows={rows} label={`새 날짜로 바꾼 ${tName} 공정표 미리 보기, 옆으로 넘겨 볼 수 있어요. 같은 내용은 목록에 있어요`} />
        <StateLegend rows={rows} days={c.days} change />
      </div>
      <ul className={`mj-num ${s.sum}`} aria-label={`새 날짜로 바꾼 ${tName} 공정표 미리 보기`}>
        {c.blocks.map((b) => {
          const moved = b.kind === "work" && b.trade === c.trade;
          const key = `${b.kind}-${b.trade ?? ""}-${b.start}`;
          return (
            <Fragment key={key}>
              {moved ? <li><b>{tName} · 지금</b><span className="mj-small">{span(c.current_start, c.current_end)} · 수락함</span></li> : null}
              <li>
                <b>{moved ? `${tName} · 새 날짜` : b.label}{!moved && b.vendor_name ? <span className={s.vn}> · {b.vendor_name}</span> : null}</b>
                <span className="mj-small">{b.kind === "work" ? blockSub(b) : `${span(b.start, b.end)} · ${blockSub(b)}`} · {moved ? "새 날짜" : STATE_TEXT[b.state]}</span>
              </li>
            </Fragment>
          );
        })}
      </ul>
    </div>
  );
}
