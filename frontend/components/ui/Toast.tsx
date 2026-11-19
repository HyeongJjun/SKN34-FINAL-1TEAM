"use client";
// 토스트(design-system 3.6): 어두운 바탕 흰 글자 14 · 아래 단추 띠 위 · role="status" · 4초 뒤 사라져요.
// 놓치면 안 되는 말('방금 다른 고객이 골랐어요')은 토스트로만 두지 않고 그 칸 아래에도 남겨요.
// 쓰는 법: const toast = useToast(); toast.show("저장했어요");  — ToastProvider는 app/layout.tsx에 있어요.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import s from "./Toast.module.css";

type Toast = { id: number; text: string; tone: "info" | "error" };
type Api = { show: (text: string, opts?: { tone?: "info" | "error"; ms?: number }) => void };

const Ctx = createContext<Api>({ show: () => {} });
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const seq = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const show = useCallback<Api["show"]>((text, opts) => {
    const id = ++seq.current;
    setList((xs) => [...xs.slice(-2), { id, text, tone: opts?.tone ?? "info" }]);
    timers.current.set(id, setTimeout(() => {
      setList((xs) => xs.filter((t) => t.id !== id));
      timers.current.delete(id);
    }, opts?.ms ?? 4000));
  }, []);

  useEffect(() => {
    const t = timers.current;
    return () => t.forEach(clearTimeout);
  }, []);

  const api = useMemo(() => ({ show }), [show]);
  return (
    <Ctx.Provider value={api}>
      {children}
      {/* 읽어 주는 칸은 늘 있어야 새 글을 읽어요 */}
      <div className={s.host} role="status" aria-live="polite">
        {list.map((t) => <p key={t.id} className={`${s.toast} ${t.tone === "error" ? s.error : ""}`}>{t.text}</p>)}
      </div>
    </Ctx.Provider>
  );
}
