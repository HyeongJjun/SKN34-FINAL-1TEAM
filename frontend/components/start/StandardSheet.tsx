// 표준견적서 한 장(C07 · C57 · C60 · D01 · D12): 큰 합계(+ 조건 바꾸기) · 줄 · 공급가 + 부가세.
// 조건 요약 칸 · '부가세 포함' 글은 두지 않아요(11-19 사용자 결정). 부가세는 줄 표 맨 아래 합계 칸에 나눠 보여요.
// 가입 전(/start/standard)과 내 공사(/projects/{id}/standard)가 같이 써요. 숫자는 모두 계산 엔진 값이고 이 조각은 더하지 않아요.
// 공급가 · 부가세를 나눠 보이는 곳은 이 합계 칸 하나예요(copy-guide F1-2).
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { BigFigure } from "@/components/ui/Money";
import { QuoteLines } from "@/components/ui/QuoteLines";
import { wonFull } from "@/lib/format";
import { daysCaption, type StdView } from "@/lib/guest/standard";
import s from "./standard.module.css";

export function StandardSheet({ view, changeHref, onChange }: { view: StdView; changeHref: string; /** 재재 화면 창: 그 자리에서 고치기 */ onChange?: () => void }) {
  const part = view.scope === "partial";
  return (
    <>
      <section className={s.group} aria-label="표준견적서 합계">
        {part ? <Badge tone="wait" className={s.badge}>부분 · 실측 후 확정</Badge> : null}
        <div className={s.totalRow}>
          {/* 목공도 하면 큰 금액은 모든 공정 합계(서버 값). 줄 표 합계는 공정마다예요 */}
          <BigFigure value={view.sum?.total ?? view.total}
            caption={[view.sum ? "도배 + 목공 합계" : "", daysCaption(view.days)].filter(Boolean).join(" · ") || false}
            sub={view.sum ? `공급가 ${wonFull(view.sum.supply)} + 부가세 ${wonFull(view.sum.vat)}` : view.budget ?? undefined} />
          {onChange ? <Button variant="text" onClick={onChange} aria-label={`조건 바꾸기 · 지금 조건: ${view.condition}`}>조건 바꾸기</Button>
            : <Button variant="text" href={changeHref} aria-label={`조건 바꾸기 · 지금 조건: ${view.condition}`}>조건 바꾸기</Button>}
        </div>
      </section>
      <section className={s.group} aria-labelledby="std-lines">
        <h2 id="std-lines" className={part || view.sum ? s.eyebrow : "mj-sr"}>{[view.sum ? "도배 줄 · 이 공정만의 합계예요" : "", part ? "고른 공간만 어림했어요" : ""].filter(Boolean).join(" · ") || "표준견적서 줄"}</h2>
        <QuoteLines lines={view.lines} totals={{ supply: view.supply, vat: view.vat, total: view.total }} vatSplit caption="표준견적서 줄" />
      </section>
      {part ? <p className={s.info}>부분 공사는 고른 공간의 넓이를 어림해 계산했어요. 실측 뒤 업체 견적서로 확정해요.</p> : null}
    </>
  );
}

/** 계산하는 동안 자리(회색 줄만, 깜빡이지 않아요) */
export function StandardSkeleton() {
  return (
    <div className={s.skel} aria-busy="true" aria-live="polite">
      <span className="mj-sr">표준견적서를 계산하고 있어요</span>
      <i /><i /><i /><i />
    </div>
  );
}
