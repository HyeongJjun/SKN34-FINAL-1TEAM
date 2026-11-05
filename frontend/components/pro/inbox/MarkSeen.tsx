"use client";
// 요청 자세히를 처음 열면 '새 요청' 표시를 지운다 (POST /vendor/visits/{id}/seen, 한 번만). 실패해도 화면은 그대로 둔다.
import { useEffect, useRef } from "react";
import { call } from "@/lib/backend/client";

export function MarkSeen({ visitId }: { visitId: string }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    call("POST", `/vendor/visits/${visitId}/seen`).catch(() => {});
  }, [visitId]);
  return null;
}
