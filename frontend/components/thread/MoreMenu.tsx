"use client";
// ⋯ 메뉴(C29): 실측 일정 보기 · 공사 보기 · 실측 취소 · 신고 · 차단을 여기 모았어요. 단추 이름 '더 보기'(CF-68).
// 업체 화면: 요청 보기 · 공사 보기 · 신고. 폰은 아래 시트, 웹은 단추 옆 작은 메뉴(B4 Menu).
// 폰 시트 메뉴에서 다른 시트를 열 때는 메뉴 시트가 뒤로 가기 기록을 걷은 뒤에 열어요(시트 위에 시트를 겹치지 않아요).
import { useState } from "react";
import type { Thread, ThreadVisit } from "@/lib/api/thread";
import { Menu, type MenuItem } from "@/components/ui/Menu";
import { CancelSheet } from "@/components/visit/CancelSheet";
import { ReportSheet } from "@/components/report/ReportSheet";

/** 사이트 안 경로만(서버가 준 링크) */
export const inner = (v: string | null | undefined) => (v && v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : null);

/** 메뉴 시트가 닫히며 걷는 뒤로 가기 기록이 끝난 뒤에 다음 시트를 열어요 */
export function afterMenu(fn: () => void) {
  if (typeof window !== "undefined" && history.state?.mjModal) {
    const once = () => { window.removeEventListener("popstate", once); setTimeout(fn, 0); };
    window.addEventListener("popstate", once);
    return;
  }
  fn();
}

export function MoreMenu({ thread, visit, role }: { thread: Thread; visit: ThreadVisit | null; role: "customer" | "vendor" }) {
  const [sheet, setSheet] = useState<"cancel" | "report" | null>(null);
  const enc = encodeURIComponent;
  const project = inner(thread.links.project);
  const items: MenuItem[] = [];
  if (role === "customer") {
    if (thread.project_id) items.push({ label: "실측 일정 보기", href: `/projects/${enc(thread.project_id)}/visits` });
    if (project) items.push({ label: "공사 보기", href: project });
    if (thread.can.cancel && thread.visit_id && thread.project_id) items.push({ label: "실측 취소", danger: true, onSelect: () => afterMenu(() => setSheet("cancel")) });
    if (thread.can.report) items.push({ label: "신고 · 차단", danger: true, onSelect: () => afterMenu(() => setSheet("report")) });
  } else {
    if (thread.visit_id) items.push({ label: "요청 보기", href: `/vendor/requests/${enc(thread.visit_id)}` });
    if (project) items.push({ label: "공사 보기", href: project });
    if (thread.can.report) items.push({ label: "신고", danger: true, onSelect: () => afterMenu(() => setSheet("report")) });
  }
  if (!items.length) return null;
  return (
    <>
      <Menu label="더 보기" icon="more" title={thread.title} items={items} />
      {role === "customer" && thread.visit_id && thread.project_id ? (
        <CancelSheet open={sheet === "cancel"} onClose={() => setSheet(null)} projectId={thread.project_id} visitId={thread.visit_id} vendorName={thread.title} slot={visit?.booked ?? null} />
      ) : null}
      <ReportSheet open={sheet === "report"} onClose={() => setSheet(null)} kind="chat" targetName={thread.title} threadId={thread.thread_id} canBlock={role === "customer"} />
    </>
  );
}
