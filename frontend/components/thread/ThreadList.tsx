"use client";
// 채팅 목록(C24 · V19 · D05 왼쪽): 얼굴 · 상대 이름표(고객: 업체 상호 / 업체: '상계동 고객') · 실측 줄 · 마지막 글 · 시각 · 안 읽은 수.
// 웹 2단에서는 지금 연 대화를 옅은 파랑으로 보여요(aria-current). 미리 보기 글은 서버가 준 값이고 화면이 한 줄로 줄여요.
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ThreadRow } from "@/lib/api/thread";
import { Count } from "@/components/ui/Badge";
import { Avatar } from "@/components/project/Kit";
import { listTime } from "./text";
import s from "./thread.module.css";

export function ThreadList({ threads, today, label = "대화 목록" }: { threads: ThreadRow[]; today: string; label?: string }) {
  const path = usePathname() ?? "";
  return (
    <ul className={s.list} aria-label={label}>
      {threads.map((t) => {
        const href = `/chat/${encodeURIComponent(t.thread_id)}`;
        const on = path === href || path.startsWith(`${href}/`);
        const preview = t.last ? (t.last.kind === "photo" && !t.last.preview ? "사진" : t.last.preview ?? "") : "";
        return (
          <li key={t.thread_id}>
            <Link href={href} className={[s.item, t.status === "read_only" ? s.itemRo : null].filter(Boolean).join(" ")} aria-current={on ? "page" : undefined}>
              <Avatar name={t.title} />
              <span className={s.itemText}>
                <span className={s.itemTitle}>{t.title}</span>
                {t.visit_label ? <span className={s.itemVisit}>{t.visit_label}</span> : null}
                {preview ? <span className={s.itemPrev}>{preview}</span> : null}
              </span>
              <span className={s.itemSide}>
                {t.last ? <time dateTime={t.last.at} className="mj-num">{listTime(t.last.at, today)}</time> : null}
                <Count n={t.unread} />
                {t.unread > 0 ? <span className="mj-sr">, 안 읽은 글 {t.unread}개</span> : null}
                {t.status === "read_only" ? <span className="mj-sr">, 읽기만 돼요</span> : null}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
