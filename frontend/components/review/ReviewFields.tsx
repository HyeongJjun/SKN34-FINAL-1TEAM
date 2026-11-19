"use client";
// 리뷰 쓰기 조각(C39): 별 · 칩 · 글 + '리뷰 기준' 줄. 사진 칸(FileDrop · PhotoGrid, POST /files kind=review_photo)과
// 보내기(POST /projects/{id}/deals/{did}/review)는 쓰는 화면(B2b 리뷰 쓰기 · B3)이 맡고, 여기서는 값 · 검사 · 보낼 몸통만 만들어요.
// 쓰는 법:
//   const [d, setD] = useState(EMPTY_REVIEW);
//   <ReviewFields value={d} onChange={setD} error={err} photos={<사진 칸 />} />
//   const msg = checkReview(d); if (!msg) await call("POST", `/projects/${enc(pid)}/deals/${enc(did)}/review`, reviewBody(d, photoIds));
import { forwardRef, type ReactNode } from "react";
import { ChoiceChips } from "@/components/ui/ChoiceChip";
import { TextArea } from "@/components/ui/Field";
import { StarInput } from "@/components/ui/Stars";
import type { Schemas } from "@/lib/backend/client";
import { ReviewRulesLine } from "./RulesSheet";
import { REVIEW_TAG_KEYS, REVIEW_TAGS, type ReviewTag } from "./tags";
import s from "./review.module.css";

export type ReviewDraft = { rating: number; tags: ReviewTag[]; body: string };
export const EMPTY_REVIEW: ReviewDraft = { rating: 0, tags: [], body: "" };
/** 서버와 같은 한도(backend review.models BODY_MAX · PHOTOS_MAX) */
export const REVIEW_BODY_MAX = 1000;
export const REVIEW_PHOTOS_MAX = 5;

export type ReviewError = { field: "rating" | "body"; message: string };

/** 보내기 전 한 번 검사. 틀린 칸과 고치는 말을 돌려줘요 */
export function checkReview(d: ReviewDraft): ReviewError | null {
  if (d.rating < 1 || d.rating > 5) return { field: "rating", message: "별점을 골라 주세요. 별을 누르면 골라져요." };
  if (d.body.trim().length > REVIEW_BODY_MAX) return { field: "body", message: `글은 ${REVIEW_BODY_MAX.toLocaleString("ko-KR")}자까지 써요. 조금 줄여 주세요.` };
  return null;
}

/** 보낼 몸통(ReviewWriteIn). 빈 글은 보내지 않아요 */
export function reviewBody(d: ReviewDraft, photoFileIds: string[] = []): Schemas["ReviewWriteIn"] {
  const body = d.body.trim();
  return { rating: d.rating, tags: [...new Set(d.tags)], body: body || null, photo_file_ids: [...new Set(photoFileIds)].slice(0, REVIEW_PHOTOS_MAX) };
}

export const ReviewFields = forwardRef<HTMLTextAreaElement, {
  value: ReviewDraft;
  onChange: (d: ReviewDraft) => void;
  error?: ReviewError | null;
  /** 사진 칸(쓰는 화면이 넣어요) */
  photos?: ReactNode;
}>(function ReviewFields({ value, onChange, error, photos }, ref) {
  return (
    <div className={s.fields}>
      <div className={s.starField}>
        <StarInput value={value.rating} onChange={(rating) => onChange({ ...value, rating })} label="별점" />
        {error?.field === "rating" ? <p className={s.err} role="alert">{error.message}</p> : null}
      </div>
      <ChoiceChips
        multiple
        legend="좋았던 점"
        hideLegend
        options={REVIEW_TAG_KEYS.map((k) => ({ value: k, label: REVIEW_TAGS[k] }))}
        value={value.tags}
        onChange={(tags) => onChange({ ...value, tags: tags as ReviewTag[] })}
      />
      <TextArea
        ref={ref}
        label="리뷰 글"
        hideLabel
        optional
        rows={4}
        maxLength={REVIEW_BODY_MAX}
        value={value.body}
        onChange={(e) => onChange({ ...value, body: e.target.value })}
        error={error?.field === "body" ? error.message : null}
      />
      {photos}
      <ReviewRulesLine />
    </div>
  );
});
