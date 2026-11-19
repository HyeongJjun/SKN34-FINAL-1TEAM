import { ReviewList } from "@/components/pro/reviews/ReviewList";
import { ProHeader, ProTabBar } from "@/components/pro/Shell";
import { Tabs } from "@/components/ui/Tabs";
import { approvedVendorGate, getVendorReviews } from "@/lib/api/vendor";

export const metadata = { title: "리뷰" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// 업체 리뷰 · 답글(V24 · V25, 알림 link: /vendor/reviews). 기본은 '답글 기다림', 기다리는 리뷰가 없으면 전체를 보여요.
export default async function VendorReviewsPage({ searchParams }: { searchParams: Promise<{ filter?: string | string[] }> }) {
  const me = await approvedVendorGate("/vendor/reviews");
  const want = one((await searchParams).filter);
  let filter: "waiting" | "all" = want === "all" ? "all" : "waiting";
  let data = await getVendorReviews(filter);
  if (!want && data && data.waiting === 0) { filter = "all"; data = await getVendorReviews("all"); }
  const pills = (
    <Tabs
      variant="pill"
      label="리뷰 거르기"
      value={filter}
      items={[
        { key: "waiting", label: "답글 기다림", count: data?.waiting ?? 0, href: "/vendor/reviews?filter=waiting" },
        { key: "all", label: "전체", href: "/vendor/reviews?filter=all" },
      ]}
    />
  );
  return (
    <>
      <ProHeader me={me} phone={{ title: "리뷰", back: "/vendor/profile" }} />
      <ReviewList data={data ?? { rating: { avg: null, count: 0, done_count: 0, tags: {} }, waiting: 0, items: [] }} filter={filter} pills={pills} />
      <ProTabBar />
    </>
  );
}
