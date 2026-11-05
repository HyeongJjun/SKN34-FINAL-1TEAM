"use client";
// 알림 한 줄. 안 읽은 알림을 누르면 읽음으로 바꾼 뒤 link로 간다(읽음 처리가 실패해도 화면은 넘긴다).
// 새 탭으로 열 때(Ctrl · ⌘ · Shift 누름)는 브라우저에 맡기고 읽음 요청만 보낸다.
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { call } from "@/lib/backend/client";

export function NotifyLink({ id, href, unread, className, children }: { id: string; href: string; unread: boolean; className: string; children: ReactNode }) {
  const router = useRouter();
  async function onClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (!unread) return;
    const read = call("POST", `/notifications/${id}/read`).catch(() => undefined);
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    await read;
    router.push(href);
  }
  return <Link href={href} className={className} onClick={onClick}>{children}</Link>;
}
