"use client";
// 채팅 틀(D05 · dev-08): 웹(≥1024)은 [목록 | 대화] 2단, 폰 · 태블릿은 목록 화면과 대화 화면이 따로예요(목록은 /chat 화면이 그려요).
// 실시간: 새 글(msg) · 읽음(read) · 다시 맞추기(resync)가 오면 목록(안 읽은 수 · 마지막 글)을 서버에서 다시 읽어요.
import { useRouter } from "next/navigation";
import { useRef, type ReactNode } from "react";
import type { ThreadRow } from "@/lib/api/thread";
import { useStream } from "@/lib/backend/stream";
import { ThreadList } from "./ThreadList";
import s from "./thread.module.css";

export function ChatShell({ threads, today, children }: { threads: ThreadRow[]; today: string; children: ReactNode }) {
  const router = useRouter();
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  useStream(["msg", "read", "resync"], () => {
    // 글이 몰려 와도 한 번만 다시 읽어요
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => router.refresh(), 300);
  });
  const one = threads.length === 0;
  return (
    <div className={one ? `${s.shell} ${s.shellOne}` : s.shell}>
      {one ? null : (
        <div className={s.webList}>
          <div className={s.listWrap}><ThreadList threads={threads} today={today} /></div>
        </div>
      )}
      <div className={s.col}>{children}</div>
    </div>
  );
}
