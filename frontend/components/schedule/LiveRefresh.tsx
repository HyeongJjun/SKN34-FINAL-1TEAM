"use client";
// 실시간 줄기(lib/backend/stream.ts)에서 이 공사 소식이 오면 화면을 다시 읽어요(router.refresh, 서버 화면 그대로).
// state {kind, project_id}가 이 공사이거나 resync(놓친 것을 다시 읽기)면 300ms 뒤 한 번만 다시 읽어요. 그리는 것은 없어요.
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { useStream } from "@/lib/backend/stream";

export function LiveRefresh({ projectId, kinds, notif = false }: { projectId?: string; kinds?: string[]; notif?: boolean }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const later = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => router.refresh(), 300);
  };
  useStream(notif ? ["state", "resync", "notif"] : ["state", "resync"], (e) => {
    if (e.type === "resync" || e.type === "notif") { later(); return; }
    if (e.type !== "state") return;
    if (projectId && e.data.project_id && e.data.project_id !== projectId) return;
    if (kinds && !kinds.includes(e.data.kind)) return;
    later();
  });
  return null;
}
