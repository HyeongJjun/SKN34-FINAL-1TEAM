"use client";
// 옆으로 넘김 상자(design-system 3.3 DataTable · 4장): 표가 칸보다 넓을 때만 초점을 받고 '옆으로 넘겨 볼 수 있어요'를 보여요.
// 넘치지 않으면 그냥 상자예요(쓸데없는 Tab 멈춤이 생기지 않게). 넓은 표 · 공정표 · 비교표 밖 상자로 써요.
import { useEffect, useRef, useState, type ReactNode } from "react";
import s from "./ScrollBox.module.css";

export function ScrollBox({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [over, setOver] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setOver(el.scrollWidth > el.clientWidth + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, []);

  return (
    <div className={[s.box, className].filter(Boolean).join(" ")}>
      {over ? <p className={s.hint} aria-hidden="true">옆으로 넘겨 볼 수 있어요</p> : null}
      <div
        ref={ref}
        className={s.scroll}
        role={over ? "region" : undefined}
        aria-label={over ? `${label}, 옆으로 넘겨 볼 수 있어요` : undefined}
        tabIndex={over ? 0 : undefined}
      >
        {children}
      </div>
    </div>
  );
}
