"use client";
// 리뷰 목록(C48): 첫 쪽은 서버가 그려 넘기고, 더 있으면 '리뷰 더 보기'로 다음 쪽을 이어 붙여요(GET …/reviews?sort=&before=).
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { call, errorText, type Schemas } from "@/lib/backend/client";
import { ReviewItem } from "./ReviewItem";
import s from "./review.module.css";

type Page = Schemas["ReviewPageOut"];
type Item = Schemas["ReviewItemOut"];

export function ReviewFeed({ projectId, vendorId, vendorName, first, sort }: {
  projectId: string;
  vendorId: string;
  vendorName: string;
  first: Page;
  sort: "latest" | "low";
}) {
  const toast = useToast();
  const [items, setItems] = useState<Item[]>(first.items);
  const [next, setNext] = useState<string | null>(first.next_before);
  const [busy, setBusy] = useState(false);

  async function more() {
    if (!next || busy) return;
    setBusy(true);
    try {
      const q = new URLSearchParams({ sort, before: next });
      const page = await call<Page>("GET", `/projects/${encodeURIComponent(projectId)}/vendors/${encodeURIComponent(vendorId)}/reviews?${q.toString()}`);
      setItems((v) => [...v, ...page.items.filter((it) => !v.some((x) => x.id === it.id))]);
      setNext(page.next_before);
    } catch (e) {
      toast.show(errorText(e), { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  if (!items.length) return <p className={s.none}>아직 리뷰가 없어요</p>;
  return (
    <>
      <ul className={s.feed} aria-label={`${vendorName} 리뷰`}>
        {items.map((it) => <li key={it.id}><ReviewItem item={it} vendorName={vendorName} /></li>)}
      </ul>
      {next ? <div className={s.more}><Button variant="secondary" busy={busy} onClick={() => void more()}>{busy ? "불러오는 중" : "리뷰 더 보기"}</Button></div> : null}
    </>
  );
}
