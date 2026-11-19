// 표(design-system 3.3 DataTable · 9판 k-tbl): 업체 데스크톱 작업함(D04) · 관리자 목록(A01~A04) · 단가 표(D02) · 반나절 칸 표(D19).
// 같은 줄을 폰(< 768)은 카드 목록, 768부터 표, 1024부터 [표 | 옆 자세히 칸 360]으로 보여요(CSS만 바꿔요, 내용은 하나).
// 줄 고르기: 서버 화면은 rowHref(예: ?sel=…, 스크롤 그대로) · 브라우저 조각 안에서는 onSelect. 줄 이름 칸의 링크 · 단추가 줄 전체를 덮어요.
// "use client"가 아니어서 서버 화면에서 cell · card 함수를 바로 넘길 수 있어요(onSelect만 브라우저 조각 안에서 써요).
// 표가 칸보다 넓으면 옆으로 넘김 상자(초점 + '옆으로 넘겨 볼 수 있어요', ScrollBox)가 돼요.
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { ScrollBox } from "./ScrollBox";
import s from "./DataTable.module.css";

export type DataColumn<T> = {
  key: string;
  label: ReactNode;
  /** 칸 내용. 없으면 row[key]를 그대로 */
  cell?: (row: T) => ReactNode;
  /** 숫자 · 금액 · 시각: 오른쪽 정렬 + 고정폭 숫자 + 줄 안 바꿈 */
  num?: boolean;
  align?: "start" | "center" | "end";
  /** 열 너비(예: "112px" · "20%"). 나머지 열이 남은 너비를 나눠요 */
  width?: string;
  /** 줄 이름 칸(하나만). 줄 머리(th scope=row)가 되고 고르기 링크가 들어가요. 없으면 첫 열 */
  primary?: boolean;
  /** 폰 카드에서 이 칸을 빼요 */
  hideOnCard?: boolean;
};
export type RowTone = "warn" | "bad";

export function DataTable<T>({
  caption, showCaption, columns, rows, rowKey, selected, rowHref, onSelect, rowTone,
  card, detail, detailLabel = "자세히", detailOnPhone = true, empty, head, foot, minWidth = 560,
}: {
  /** 표 이름(읽기용 caption). 화면에 제목이 따로 있으면 숨겨 둬요(기본) */
  caption: string;
  showCaption?: boolean;
  columns: DataColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** 고른 줄(옆 자세히 칸에 보이는 줄): 옅은 파랑 + 왼쪽 3px 파랑 줄 */
  selected?: string | null;
  /** 줄 고르기(주소): 서버 화면 */
  rowHref?: (row: T) => string;
  /** 줄 고르기(브라우저 조각 안) */
  onSelect?: (key: string, row: T) => void;
  /** 경고 줄(주황 옅게) · 오류 줄(빨강 옅게). 뜻은 칸 글로도 알려요 */
  rowTone?: (row: T) => RowTone | null | undefined;
  /** 폰 카드 하나를 직접 그려요(V03 작업함 카드). 없으면 줄 이름 + 칸 이름 · 값 줄 */
  card?: (row: T) => ReactNode;
  /** 옆 자세히 칸(≥ 1024 오른쪽에 붙어요, 좁으면 목록 아래) */
  detail?: ReactNode;
  detailLabel?: string;
  /** 폰에서도 자세히 칸을 보일지(기본 보임). 카드에 할 일 단추가 다 있으면 false */
  detailOnPhone?: boolean;
  /** 줄이 없을 때(EmptyState 등). 없으면 '아직 없어요' */
  empty?: ReactNode;
  /** 표 위: 탭 · 정렬 */
  head?: ReactNode;
  /** 표 아래(같은 묶음 안): 범례 · 더 보기 */
  foot?: ReactNode;
  /** 이보다 좁으면 옆으로 넘겨요(px). 너비를 정한 열의 합 + 정하지 않은 열마다 180보다 작으면 그 값을 써요 */
  minWidth?: number;
}) {
  const prim = columns.find((c) => c.primary) ?? columns[0];
  // 너비를 정한 열(px)만으로 표가 꽉 차서 나머지 열이 글자 하나씩 꺾이지 않게, 정하지 않은 열마다 180px은 남겨요
  const fixed = columns.reduce((sum, c) => sum + (c.width?.endsWith("px") ? parseFloat(c.width) : 0), 0);
  const tableMin = Math.max(minWidth, fixed + columns.filter((c) => !c.width).length * 180);
  const value = (c: DataColumn<T>, row: T): ReactNode => (c.cell ? c.cell(row) : ((row as Record<string, unknown>)[c.key] as ReactNode));
  const pickable = Boolean(rowHref || onSelect);
  const pick = (row: T, key: string, children: ReactNode) => {
    const on = key === selected;
    if (rowHref) return <Link href={rowHref(row)} scroll={false} className={s.pick} aria-current={on ? "true" : undefined}>{children}</Link>;
    if (onSelect) return <button type="button" className={s.pick} aria-current={on ? "true" : undefined} onClick={() => onSelect(key, row)}>{children}</button>;
    return children;
  };
  const cellCls = (c: DataColumn<T>) => [c.num ? s.num : null, c.align === "end" ? s.end : c.align === "center" ? s.center : null].filter(Boolean).join(" ") || undefined;
  const rowCls = (key: string, row: T, base: string) => {
    const tone = rowTone?.(row);
    return [base, key === selected ? s.sel : null, tone ? s[tone] : null, pickable ? s.pickable : null].filter(Boolean).join(" ");
  };

  const list = rows.length === 0 ? (
    <div className={s.group}>{empty ?? <p className={s.empty}>아직 없어요</p>}</div>
  ) : (
    <>
      <div className={`${s.group} ${s.tableBox}`}>
        <ScrollBox label={caption}>
          <table className={s.table} style={{ "--dt-min": `${tableMin}px` } as CSSProperties}>
            <caption className={showCaption ? s.caption : "mj-sr"}>{caption}</caption>
            <colgroup>
              {columns.map((c) => <col key={c.key} style={c.width ? { width: c.width } : undefined} />)}
            </colgroup>
            <thead>
              <tr>{columns.map((c) => <th key={c.key} scope="col" className={cellCls(c)}>{c.label}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const k = rowKey(row);
                return (
                  <tr key={k} className={rowCls(k, row, s.tr)}>
                    {columns.map((c) => (c === prim
                      ? <th key={c.key} scope="row" className={[s.rowHead, cellCls(c)].filter(Boolean).join(" ")}>{pick(row, k, value(c, row))}</th>
                      : <td key={c.key} className={cellCls(c)}>{value(c, row)}</td>))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollBox>
        {foot ? <div className={s.foot}>{foot}</div> : null}
      </div>
      <ul className={s.cards} aria-label={caption}>
        {rows.map((row) => {
          const k = rowKey(row);
          return (
            <li key={k} className={rowCls(k, row, s.card)}>
              {card ? card(row) : (
                <>
                  <div className={s.cardTitle}>{pick(row, k, value(prim, row))}</div>
                  <dl className={s.cardRows}>
                    {columns.filter((c) => c !== prim && !c.hideOnCard).map((c) => (
                      <div key={c.key}><dt>{c.label}</dt><dd className={c.num ? s.num : undefined}>{value(c, row)}</dd></div>
                    ))}
                  </dl>
                </>
              )}
            </li>
          );
        })}
      </ul>
      {foot ? <div className={s.phoneFoot}>{foot}</div> : null}
    </>
  );

  return (
    <div className={[s.wrap, detail ? s.withDetail : null].filter(Boolean).join(" ")}>
      <div className={s.main}>
        {head ? <div className={s.head}>{head}</div> : null}
        {list}
      </div>
      {detail ? <aside className={[s.detail, detailOnPhone ? null : s.noPhone].filter(Boolean).join(" ")} aria-label={detailLabel}>{detail}</aside> : null}
    </div>
  );
}

/** 표 칸 두 줄: 굵은 이름 + 아래 작은 설명(D04 '상계동 69.4㎡ / 노원구 · 아파트 · …') */
export function CellText({ main, sub }: { main: ReactNode; sub?: ReactNode }) {
  return (
    <span className={s.cellText}>
      <b>{main}</b>
      {sub ? <span className={s.sub}>{sub}</span> : null}
    </span>
  );
}
