import { notFound, redirect } from "next/navigation";
import { QuoteForm } from "@/components/pro/quote/QuoteForm";
import { ProHeader } from "@/components/pro/Shell";
import { Desk } from "@/components/pro/desk/Desk";
import { deskFeed } from "@/components/pro/desk/feed";
import { approvedVendorGate, getQuoteBoard, getVendorVisit, vendorNow } from "@/lib/api/vendor";
import { dateSeoul } from "@/lib/format";

export const metadata = { title: "실측 견적서 올리기" };

// 실측 견적서 올리기(V10 v_quote): 실측 확정 · 실측 받음 뒤에 보내요(그 밖이면 서버가 409). 남의 요청이면 404.
export default async function VendorQuotePage({ params }: { params: Promise<{ visitId: string }> }) {
  const { visitId } = await params;
  const me = await approvedVendorGate(`/vendor/requests/${encodeURIComponent(visitId)}/quote`);
  const [v, board] = await Promise.all([getVendorVisit(visitId), getQuoteBoard(visitId)]);
  if (!v || !board) notFound();
  // 실측일 전이면 견적서를 낼 수 없어요(실측한 날은 오늘까지만, 서버 422). 요청 화면으로 돌려보내 안내를 봐요
  if (v.status === "booked" && v.booked && v.booked.day > dateSeoul(vendorNow("quote"))) redirect(`/vendor/requests/${encodeURIComponent(v.id)}`);
  const feed = await deskFeed(v.id, vendorNow("inbox"));
  return (
    <>
      <ProHeader me={me} phone={{ title: "실측 견적서 올리기", back: `/vendor/requests/${encodeURIComponent(v.id)}` }} />
      <Desk feed={feed} say={["실측 견적서 낼 차례예요.", "금액 · 부가세 · 공사 기간 · 유효기간을 말로 적으면 칸을 채워요. 견적서 파일은 오른쪽에서 올려 주세요."]}>
        <QuoteForm v={v} board={board} now={vendorNow("quote")} />
      </Desk>
    </>
  );
}
