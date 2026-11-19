// 리뷰 한 칸(design-system 3.3 ReviewItem · ReplyBox · TagList · 9판 k-rvw · r-reply): 쓴 사람 · 별 · 날짜 · 칩 · 글 · 사진 · 집 사본 · 업체 답글.
// 쓴 사람은 API가 가린 이름(author_label '김○○' · '탈퇴한 고객')을 그대로 써요. 업체 화면에는 '고객'으로 와요.
// 사진은 GET /reviews/{rid}/photos/{fid}(보이는 리뷰는 로그인한 고객이 봐요).
// 서버 · 브라우저 어디서나 써요(상태 없음). 고객 글과 업체 답글은 글자로만 보여요(링크 · 마크업으로 바꾸지 않아요).
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { PhotoGrid } from "@/components/ui/PhotoGrid";
import type { Schemas } from "@/lib/backend/client";
import { reviewDate, tagText } from "./tags";
import s from "./review.module.css";

type Item = Schemas["ReviewItemOut"];
type Reply = Schemas["ReplyOut"];

/** 별 다섯 개 보여 주기. 읽는 글 '5점 만점에 4점'(CF-71) */
export function StarRow({ value }: { value: number }) {
  return (
    <span className={s.stars}>
      <span aria-hidden="true" className={s.starIcons}>
        {[1, 2, 3, 4, 5].map((i) => <Icon key={i} name="star" size={16} filled={i <= value} strokeWidth={1.5} className={i <= value ? s.on : s.off} />)}
      </span>
      <span className="mj-sr">5점 만점에 {value}점</span>
    </span>
  );
}

/** 고객이 고른 칩(읽기만) */
export function TagList({ tags }: { tags: string[] }) {
  const words = tags.map(tagText).filter((w): w is string => !!w);
  if (!words.length) return null;
  return <ul className={s.tags} aria-label="고른 말">{words.map((w) => <li key={w}>{w}</li>)}</ul>;
}

/** 업체 답글(리뷰마다 하나) */
export function ReplyBox({ vendorName, reply }: { vendorName: string; reply: Reply }) {
  return (
    <div className={s.reply}>
      <b>{vendorName} 답글</b>
      <p>{reply.body}</p>
      <span className="mj-num"><time dateTime={reply.created_at}>{reviewDate(reply.edited_at ?? reply.created_at)}</time></span>
    </div>
  );
}

export function ReviewItem({ item, vendorName }: { item: Item; vendorName: string }) {
  return (
    <article className={s.item}>
      <div className={s.top}>
        <b className={s.author}>{item.author_label}</b>
        <StarRow value={item.rating} />
        <span className={`${s.date} mj-num`}><time dateTime={item.created_at}>{reviewDate(item.created_at)}</time></span>
        {item.edited ? <Badge tone="mute">수정됨</Badge> : null}
      </div>
      <TagList tags={item.tags} />
      {item.body ? <p className={s.body}>{item.body}</p> : null}
      {item.photos.length ? (
        <PhotoGrid
          label="리뷰 사진"
          className={s.photos}
          photos={item.photos.map((f, i) => ({ key: f, src: `/api/reviews/${encodeURIComponent(item.id)}/photos/${encodeURIComponent(f)}`, alt: `리뷰 사진 ${i + 1}` }))}
        />
      ) : null}
      <p className={s.ctx}>{item.context_label} · 믿집 공사 확인</p>
      {item.reply ? <ReplyBox vendorName={vendorName} reply={item.reply} /> : null}
    </article>
  );
}
