"use client";
// 업체 리뷰 · 답글(V24 v_reviews) + 답글 쓰기(V25 v_reply, I4 A): 리뷰마다 답글 하나. 고칠 수 있고, 처음 달면 리뷰를 쓴 고객에게 알림이 가요.
// 고객이 리뷰를 고치면 '수정됨'이 붙어요. 답글 → PUT /vendor/reviews/{rid}/reply(처음 201 · 고치면 200).
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Main, PageHead } from "@/components/site/Frame";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { TextArea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import type { VendorReviews } from "@/lib/api/vendor";
import { errorText } from "@/lib/backend/client";
import { dateLong, dateSeoul } from "@/lib/format";
import { enc, send } from "../send";
import { REVIEW_TAGS } from "../text";
import { Group, Small } from "../ui/parts";
import s from "./reviews.module.css";

type Item = VendorReviews["items"][number];
/** CF-63: '2027.1.5'(0을 붙이지 않아요) */
const dotDay = (t: string) => { const [y, m, d] = dateSeoul(t).split("-"); return `${y}.${Number(m)}.${Number(d)}`; };

function StarRow({ n }: { n: number }) {
  return (
    <span className={s.stars}>
      <span aria-hidden="true" className={s.starIcons}>{[1, 2, 3, 4, 5].map((i) => <Icon key={i} name="star" size={16} filled={i <= n} strokeWidth={1.5} className={i <= n ? s.on : s.off} />)}</span>
      <span className="mj-sr">5점 만점에 {n}점</span>
    </span>
  );
}

export function ReviewList({ data, filter, pills }: { data: VendorReviews; filter: "waiting" | "all"; pills: ReactNode }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState<Item | null>(null);
  const [body, setBody] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const r = data.rating;

  function start(it: Item) { setOpen(it); setBody(it.reply?.body ?? ""); setErr(null); }
  async function post() {
    if (!open || busy) return;
    if (!body.trim()) { setErr("답글을 적어 주세요."); return; }
    setBusy(true);
    try {
      await send("PUT", `/vendor/reviews/${enc(open.id)}/reply`, { body: body.trim() });
      toast.show(open.reply ? "답글을 고쳤어요." : "답글을 올렸어요. 리뷰를 쓴 고객에게 알림이 가요.");
      setOpen(null);
      router.refresh();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Main narrow>
        <PageHead title="리뷰" crumbs={[{ label: "업체 정보", href: "/vendor/profile" }, { label: "리뷰" }]} />
        <Group>
          <div className={s.score}>
            <p className={s.big}><Icon name="star" size={26} filled strokeWidth={1.5} className={s.on} /><b className="mj-num" aria-hidden="true">{r.avg ?? "—"}</b><span className="mj-sr">별점 {r.avg ?? "없음"}</span></p>
            <span className={`${s.cnt} mj-num`}>리뷰 {r.count} · 믿집 공사 {r.done_count}건</span>
          </div>
          {pills}
        </Group>
        {data.items.length ? (
          <ul className={s.list} aria-label={filter === "waiting" ? "답글 기다리는 리뷰" : "리뷰 전체"}>
            {data.items.map((it) => (
              <li key={it.id} className={s.item}>
                <div className={s.ih}><StarRow n={it.rating} /><span className={`${s.date} mj-num`}>{dotDay(it.created_at)}</span>{it.edited ? <Badge tone="mute">수정됨</Badge> : null}</div>
                {it.tags.length ? <ul className={s.tags} aria-label="고른 칩">{it.tags.map((t) => <li key={t}>{REVIEW_TAGS[t] ?? "그 밖"}</li>)}</ul> : null}
                {it.body ? <p className={s.body}>{it.body}</p> : null}
                <Small>{it.context_label} · 믿집 공사 확인</Small>
                {it.reply ? (
                  <div className={s.reply}>
                    <b>내 답글</b>
                    <p>{it.reply.body}</p>
                    <div className={s.rf}><span className="mj-num">{dotDay(it.reply.edited_at ?? it.reply.created_at)} · 고칠 수 있어요</span><Button variant="text" onClick={() => start(it)}>답글 고치기</Button></div>
                  </div>
                ) : (
                  <div><Button variant="text" onClick={() => start(it)}>답글 쓰기</Button></div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon="star" title={filter === "waiting" ? "답글을 기다리는 리뷰가 없어요" : "아직 리뷰가 없어요"}>고객이 공사 끝을 확인하면 리뷰를 쓸 수 있어요.</EmptyState>
        )}
      </Main>
      <Sheet
        open={!!open}
        onClose={() => !busy && setOpen(null)}
        dismissible={!busy}
        title={open?.reply ? "답글 고치기" : "답글 쓰기"}
        actions={<Button size="lg" block onClick={post} busy={busy}>{busy ? "보내는 중" : "답글 올리기"}</Button>}
      >
        {open ? <p className={s.sub}><span>{open.context_label}</span><StarRow n={open.rating} /><span className="mj-num">{dateLong(open.created_at)}</span></p> : null}
        <TextArea label="답글" rows={5} maxLength={500} value={body} error={err} onChange={(e) => { setBody(e.target.value); setErr(null); }} />
        <Small>리뷰마다 답글 하나예요. 고칠 수 있고, 리뷰를 쓴 고객에게 알림이 가요.</Small>
      </Sheet>
    </>
  );
}
