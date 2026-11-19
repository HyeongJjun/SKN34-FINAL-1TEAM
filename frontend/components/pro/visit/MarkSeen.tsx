"use client";
// 새 요청을 처음 열면 '새 요청' 표시를 지워요(POST /vendor/visits/{vid}/seen, 한 번만). 실패해도 화면은 그대로 둬요.
import { useEffect, useRef } from "react";
import { enc, send } from "../send";

export function MarkSeen({ visitId }: { visitId: string }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    send("POST", `/vendor/visits/${enc(visitId)}/seen`).catch(() => {});
  }, [visitId]);
  return null;
}
