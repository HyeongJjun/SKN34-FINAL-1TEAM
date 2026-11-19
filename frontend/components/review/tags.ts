// 리뷰 칩 · 날짜 말(리뷰 쓰기 C39 · 업체 자세히 C11 · 리뷰 전체 C48 · 업체 리뷰 V24 · V25가 같이 써요).
import { dateSeoul } from "@/lib/format";

export type ReviewTag = "seam" | "on_time" | "kind" | "tidy";
export const REVIEW_TAG_KEYS: ReviewTag[] = ["seam", "on_time", "kind", "tidy"];
export const REVIEW_TAGS: Record<ReviewTag, string> = {
  seam: "이음매가 깔끔해요",
  on_time: "약속한 날에 끝냈어요",
  kind: "설명이 친절해요",
  tidy: "뒷정리가 깔끔해요",
};
export const tagText = (k: string): string | null => REVIEW_TAGS[k as ReviewTag] ?? null;

/** 많이 고른 칩 n개(수가 같으면 위 순서). API가 센 수를 그대로 견줘요 */
export function topTags(tags: Record<string, number> | null | undefined, n = 2): string[] {
  if (!tags) return [];
  return REVIEW_TAG_KEYS.filter((k) => (tags[k] ?? 0) > 0)
    .sort((a, b) => (tags[b] ?? 0) - (tags[a] ?? 0))
    .slice(0, n)
    .map((k) => REVIEW_TAGS[k]);
}

/** 리뷰 · 답글 날짜 '2026.11.2'(서울 기준, 0을 붙이지 않아요 — CF-63) */
export function reviewDate(isoTime: string): string {
  const [y, m, d] = dateSeoul(isoTime).split("-").map(Number);
  return `${y}.${m}.${d}`;
}
