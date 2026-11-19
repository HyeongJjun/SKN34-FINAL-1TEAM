// 별점 요약(C48 · C49 머리 '★ 4.8 · 리뷰 5 · 믿집 공사 5건'). 평균 · 수는 API가 센 값 그대로예요.
import { Icon } from "@/components/ui/Icon";
import type { Schemas } from "@/lib/backend/client";
import { decText } from "@/lib/format";
import s from "./review.module.css";

type Rating = Schemas["RatingOut"];

/** '4.8' · 리뷰가 없으면 null */
export const avgText = (r: Rating | null | undefined): string | null => (r && r.count > 0 && r.avg != null ? Number(decText(r.avg)).toFixed(1) : null);

export function RatingSummary({ rating }: { rating: Rating }) {
  const avg = avgText(rating);
  const sub = `리뷰 ${rating.count} · 믿집 공사 ${rating.done_count}건`;
  if (!avg) return <p className={s.sumNone}>아직 리뷰가 없어요<span>{`믿집 공사 ${rating.done_count}건`}</span></p>;
  return (
    <p className={s.sum}>
      <span className={s.sumBig} aria-hidden="true"><Icon name="star" size={20} filled strokeWidth={1.5} className={s.on} /><span className="mj-num">{avg}</span></span>
      <span className="mj-sr">별점 {avg},</span>
      <span className={`${s.sumSub} mj-num`}>{sub}</span>
    </p>
  );
}
