"use client";
// 웹 머리 '알림 n' → 펼침 370px(D09): 최근 알림 · '모두 읽음' · '모두 보기'. 어느 화면에서나 열려요(작은 손질).
// 목록은 펼칠 때만 불러요(GET /notifications). 알림을 누르면 읽음을 보내고 그 일로 가요.
// 폰은 아래 탭 바 '알림'이 대신해요. 안 읽은 수는 서버가 그린 값으로 시작하고 실시간 한 줄기(LiveProvider)의 notif로 바뀌어요.
import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { call, type Schemas } from "@/lib/backend/client";
import { listStamp } from "@/lib/format";
import { Count } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { NotifyRow } from "@/components/ui/NotifyRow";
import { useLive, useLiveEvent, useLiveUnread } from "./LiveProvider";
import s from "./header.module.css";

type Page = Schemas["NotificationPage"];
const SHOW = 5;

export function NotifyBell({ unread: start }: { unread: number }) {
  const [open, setOpen] = useState(false);
  const unread = useLiveUnread(start);
  const { setUnread } = useLive();
  const [page, setPage] = useState<Page | null | "error">(null);
  const [fresh, setFresh] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const id = useId();

  // 펼쳐 둔 채 새 알림이 오면 목록을 다시 불러요
  useLiveEvent("notif", () => { if (open) setFresh((n) => n + 1); });

  useEffect(() => {
    if (!open) return;
    let alive = true;
    call<Page>("GET", "/notifications")
      .then((p) => { if (alive) { setPage(p); setUnread(p.unread); } })
      .catch(() => { if (alive) setPage("error"); });
    return () => { alive = false; };
  }, [open, fresh, setUnread]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); btn.current?.focus(); } };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  async function readAll() {
    try {
      await call("POST", "/notifications/read-all");
      setUnread(0);
      setPage((p) => (p && p !== "error" ? { ...p, unread: 0, items: p.items.map((n) => ({ ...n, read: true })) } : p));
    } catch {
      /* 다음에 펼칠 때 다시 읽어요 */
    }
  }
  function readOne(nid: string, read: boolean) {
    setOpen(false);
    if (!read) call("POST", `/notifications/${nid}/read`).catch(() => undefined);
  }

  const label = unread > 0 ? `알림, 새 알림 ${unread}개` : "알림";
  const items = page && page !== "error" ? page.items.slice(0, SHOW) : [];
  return (
    <div ref={box} className={s.pop}>
      <button ref={btn} type="button" className={s.bell} aria-label={label} aria-expanded={open} aria-controls={open ? `${id}-drop` : undefined} onClick={() => setOpen((v) => !v)}>
        <Icon name="bell" size={20} />
        <span>알림</span>
        <Count n={unread} />
      </button>
      {open ? (
        <div id={`${id}-drop`} className={s.drop}>
          <div className={s.dropHead}>
            <b>알림</b>
            {unread > 0 ? <button type="button" className={s.textBtn} onClick={readAll}>모두 읽음</button> : null}
          </div>
          {page === null ? (
            <p className={s.dropNote}>알림을 불러오고 있어요</p>
          ) : page === "error" ? (
            <p className={s.dropNote}>알림을 불러오지 못했어요. 알림 화면에서 다시 볼 수 있어요.</p>
          ) : items.length === 0 ? (
            <p className={s.dropNote}>새 알림이 오면 여기에 보여요</p>
          ) : (
            <div className={s.dropList}>
              {items.map((n) => (
                <NotifyRow key={n.id} href={n.link} title={n.body} time={listStamp(n.created_at)} unread={!n.read} onOpen={() => readOne(n.id, n.read)} />
              ))}
            </div>
          )}
          <Link href="/notifications" className={s.dropAll} onClick={() => setOpen(false)}>모두 보기<Icon name="chevron-right" size={16} /></Link>
        </div>
      ) : null}
    </div>
  );
}
