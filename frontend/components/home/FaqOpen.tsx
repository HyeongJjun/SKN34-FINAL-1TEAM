"use client";
// 주소 끝 #질문 id(로그인 전 AI 칸 칩 · 링크)로 오면 그 질문을 펼치고 그리로 옮겨 가요. 화면에 그리는 것은 없어요.
import { useEffect } from "react";

export function FaqOpen() {
  useEffect(() => {
    const open = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!/^q-[a-z-]+$/.test(id)) return;
      const el = document.getElementById(id);
      if (el instanceof HTMLDetailsElement) {
        el.open = true;
        el.querySelector("summary")?.focus();
        el.scrollIntoView({ block: "start" });
      }
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);
  return null;
}
